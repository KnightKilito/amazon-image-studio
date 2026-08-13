import type { APlusLayoutGroup } from '../types'
import APlusLayoutEditor from './APlusLayoutEditor'

/** @deprecated New code should render APlusLayoutEditor with an explicit content type and tier. */
export default function PremiumAPlusLayoutEditor({ groups, onChange, disabled = false }: {
  groups: APlusLayoutGroup[]
  onChange: (groups: APlusLayoutGroup[]) => void
  disabled?: boolean
}) {
  return <APlusLayoutEditor contentType="premium" tier="2K" groups={groups} onChange={onChange} disabled={disabled} />
}
