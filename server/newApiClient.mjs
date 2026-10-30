// Dashboard credentials never leave this process. Contract: New API v1.0.0-rc.46.
export class PlatformError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export class NewApiClient {
  constructor(baseUrl, fetchImpl = fetch) { this.baseUrl = baseUrl.replace(/\/+$/, ''); this.fetch = fetchImpl }
  async request(path, auth = {}, method = 'GET', body, securityProof) {
    let response
    try {
      response = await this.fetch(this.baseUrl + path, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json',
          ...(securityProof ? { 'X-Security-Proof': securityProof } : {}),
          ...(auth.userId ? { 'New-Api-User': String(auth.userId) } : {}),
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
          ...(auth.cookie ? { Cookie: auth.cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch { throw new PlatformError(502, 'New API 暂时不可用，请稍后重试') }
    const cookies = response.headers.getSetCookie?.() || []
    if (cookies.length) {
      const jar = new Map((auth.cookie || '').split('; ').filter(Boolean).map(item => [item.split('=')[0], item]))
      for (const cookie of cookies) { const item = cookie.split(';')[0]; jar.set(item.split('=')[0], item) }
      auth.cookie = [...jar.values()].join('; ')
    }
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.success === false || !result) {
      // Do not echo an upstream response that may contain keys or private routing details.
      throw new PlatformError(response.status === 401 ? 401 : response.status === 403 ? 403 : 502,
        response.status === 401 ? '登录已失效，请重新登录' : 'New API 拒绝请求，请检查账户或在管理员端查看详情')
    }
    return result.data
  }
  async login(username, password) {
    const auth = {}
    const data = await this.request('/api/user/login', auth, 'POST', { username, password })
    if (!data?.access_token || !data.user?.id) throw new PlatformError(401, '登录未完成；本版本仅支持密码登录，请检查 New API 登录策略')
    auth.accessToken = data.access_token
    auth.userId = data.user.id
    return { auth, user: data.user }
  }
  async changePassword(auth, user, currentPassword, newPassword) {
    let proof
    try {
      proof = await this.request('/api/verify', auth, 'POST', { scope: 'account.password.change', method: 'password', password: currentPassword })
    } catch { throw new PlatformError(400, '当前密码验证失败，或账户要求额外安全验证。请检查密码；如已启用双重验证，请前往 New API 修改。') }
    if (!proof?.proof_token) throw new PlatformError(502, '安全验证未完成，密码未提交修改')
    let result
    try {
      result = await this.request('/api/user/self', auth, 'PUT', { username: user.username, display_name: user.display_name || user.username, password: newPassword, original_password: currentPassword }, proof.proof_token)
    } catch { throw new PlatformError(502, '未能确认密码修改结果，请尝试重新登录确认；不要连续重复提交。') }
    // Password changes rotate New API credentials. Never return or persist the new bundle.
    if (result?.access_token) auth.accessToken = result.access_token
    await this.request('/api/user/auth/logout', auth, 'POST', {}).catch(() => {})
  }
  async self(auth) {
    try { return await this.request('/api/user/self', auth) }
    catch (error) {
      if (error.status !== 401 || !auth.cookie) throw error
      const refreshed = await this.request('/api/user/auth/refresh', auth, 'POST', {})
      if (!refreshed?.access_token) throw new PlatformError(401, '登录已失效，请重新登录')
      auth.accessToken = refreshed.access_token
      return this.request('/api/user/self', auth)
    }
  }
  async proxyToken(auth, store, models) {
    let state = store.token(auth.userId)
    if (state?.key) {
      if (!state.allUserModels) {
        const remote = await this.request(`/api/token/${state.id}`, auth)
        await this.request('/api/token/', auth, 'PUT', { ...remote, model_limits_enabled: false, model_limits: '' })
        store.putToken(auth.userId, { ...state, models, allUserModels: true })
      }
      return state.key
    }
    if (!state) {
      state = { name: `studio-${auth.userId}-${crypto.randomUUID().slice(0, 8)}`, pending: false }
      store.putToken(auth.userId, state)
    }
    const lookup = () => this.request(`/api/token/search?keyword=${encodeURIComponent(state.name)}&p=1&page_size=100`, auth)
    let data = await lookup()
    let match = (data?.items || []).find(item => item.name === state.name)
    if (!match && state.pending) throw new PlatformError(503, '代理令牌创建结果待核实，请管理员检查 New API 令牌列表；未自动重复创建')
    if (!match) {
      store.putToken(auth.userId, { ...state, pending: true })
      await this.request('/api/token/', auth, 'POST', {
        name: state.name, expired_time: -1, unlimited_quota: true, remain_quota: 0,
        model_limits_enabled: false, model_limits: '', group: '', allow_user_quota_query: false,
      })
      data = await lookup()
      match = (data?.items || []).find(item => item.name === state.name)
    }
    if (!match) throw new PlatformError(503, '代理令牌尚未就绪，请稍后重试')
    const result = await this.request(`/api/token/${match.id}/key`, auth, 'POST', {})
    if (!result?.key) throw new PlatformError(502, '无法取得代理令牌')
    const key = result.key.startsWith('sk-') ? result.key : `sk-${result.key}`
    store.putToken(auth.userId, { ...state, pending: false, id: match.id, key, models, allUserModels: true })
    return key
  }
}
