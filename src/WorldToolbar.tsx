import { useRef, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function WorldToolbar({ collapsed, onCollapse, children }: {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  const toggle = useRef<HTMLButtonElement>(null);
  return <div className="world-toolbar world-toolbar--compact" role="group" aria-label="World controls" data-collapsed={collapsed}
    onKeyDown={event => {
      if (event.key !== 'Escape' || collapsed || event.defaultPrevented) return;
      event.preventDefault(); onCollapse(true); toggle.current?.focus();
    }}>
    {/* Keep controls mounted so their keyboard shortcuts work when the dock is hidden. */}
    <div id="world-toolbar-actions" className="world-toolbar-actions" hidden={collapsed}>{children}</div>
    <button ref={toggle} type="button" className="toolbar-toggle" aria-label={collapsed ? 'Expand world controls' : 'Collapse world controls'}
      aria-expanded={!collapsed} aria-controls="world-toolbar-actions" title={collapsed ? 'Expand world controls' : 'Collapse world controls'}
      onClick={() => onCollapse(!collapsed)}>
      {collapsed ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
      {collapsed && <span>Controls</span>}
    </button>
  </div>;
}
