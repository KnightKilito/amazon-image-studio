# Findings

- 首页图片排序由 `InputBar.tsx` 内每个缩略图的原生 HTML5 drag 事件处理，最终调用 store 的 `moveInputImage(fromIdx, toIdx)`；store 移动与遮罩图保护逻辑本身正常。
- 当前 `drop` 只读取最近一次 `dragover` 写入的 `imageDragOverIndexRef`，若快速释放、停在源缩略图、或落点位于缩略图间隙/列表空白区，没有有效目标便静默不排序，符合“偶发失效”。
- 缩略图区域缺少容器级拖拽兜底；页面 document 级文件拖入监听会接收所有拖拽事件，内部排序落到间隙时会被当作普通页面拖拽收尾。
- 现有排序仅写入 `text/plain`，和外部图片/agent 图片拖入的数据通道混用，缺少内部排序的明确 MIME 标识。
- 本地页面实测确认缩略图中央由透明的全覆盖“编辑”按钮接管鼠标命中；该子按钮未声明 draggable，导致从图片主体开始拖动时父级 `dragstart` 在浏览器中不稳定，是另一处高概率触发源。
