import { useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow'
import 'reactflow/dist/style.css'

const NODE_TYPES = {
  start: {
    label: 'Inbound Call',
    description: 'Entry point for an incoming call',
    color: '#22c55e',
    inputs: [],
    outputs: ['next'],
  },
  menu: {
    label: 'IVR Menu',
    description: 'Play playbacks and route by digit',
    color: '#f59e0b',
    inputs: ['in'],
    outputs: ['invalid', 'timeout'],
  },
  extension: {
    label: 'Extension',
    description: 'Ring a specific desk or phone',
    color: '#3b82f6',
    inputs: ['in'],
    outputs: ['answered', 'busy', 'noanswer', 'failed'],
  },
  queue: {
    label: 'Queue',
    description: 'Place caller into a queue',
    color: '#8b5cf6',
    inputs: ['in'],
    outputs: ['answered', 'timeout', 'abandon', 'full', 'joinempty', 'leaveempty'],
  },
  mixmonitor: {
    label: 'MixMonitor',
    description: 'Record the call to a file',
    color: '#14b8a6',
    inputs: ['in'],
    outputs: ['next'],
  },
  audiosocket: {
    label: 'AudioSocket',
    description: 'Stream audio to an external service',
    color: '#ef4444',
    inputs: ['in'],
    outputs: ['next'],
  },
  webhook: {
    label: 'Webhook',
    description: 'Call an external HTTP endpoint',
    color: '#06b6d4',
    inputs: ['in'],
    outputs: ['next'],
  },
  condition: {
    label: 'Switch Condition',
    description: 'Route the call by a stored value',
    color: '#f97316',
    inputs: ['in'],
    outputs: ['true', 'false'],
  },
  wait: {
    label: 'Wait',
    description: 'Pause the call for a fixed time',
    color: '#84cc16',
    inputs: ['in'],
    outputs: ['next'],
  },
  waitexten: {
    label: 'WaitExten',
    description: 'Wait for DTMF after playback',
    color: '#eab308',
    inputs: ['in'],
    outputs: ['next'],
  },
  playback: {
    label: 'Playback',
    description: 'Play a prompt and continue',
    color: '#22c55e',
    inputs: ['in'],
    outputs: ['next'],
  },
  noop: {
    label: 'NoOp',
    description: 'Write a log message without changing call flow',
    color: '#94a3b8',
    inputs: ['in'],
    outputs: ['next'],
  },
  set: {
    label: 'Set',
    description: 'Assign a channel variable',
    color: '#a855f7',
    inputs: ['in'],
    outputs: ['next'],
  },
  readdigit: {
    label: 'Read Digit',
    description: 'Read one digit into a variable',
    color: '#fb7185',
    inputs: ['in'],
    outputs: ['next', 'invalid', 'timeout'],
  },
  hangup: {
    label: 'Hang Up',
    description: 'End the call immediately',
    color: '#64748b',
    inputs: ['in'],
    outputs: [],
  },
}

const EDGE_STYLE = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
  style: { stroke: '#94a3b8', strokeWidth: 2 },
}

const QUEUE_STRATEGIES = [
  { value: 'ringall', label: 'Ring All', behavior: 'Ring all available agents simultaneously' },
  { value: 'leastrecent', label: 'Least Recent', behavior: 'Ring the agent who has received a call least recently' },
  { value: 'fewestcalls', label: 'Fewest Calls', behavior: 'Ring the agent with the fewest completed calls' },
  { value: 'random', label: 'Random', behavior: 'Choose a random available agent' },
  { value: 'rrmemory', label: 'Round Robin (Remember)', behavior: 'Continue round-robin from the last agent called' },
  { value: 'rrordered', label: 'Round Robin (Fixed Order)', behavior: 'Round-robin using a fixed order' },
  { value: 'linear', label: 'Linear', behavior: 'Ring agents sequentially in configured order' },
  { value: 'wrandom', label: 'Weighted Random', behavior: 'Random selection using agent weights' },
]

const HANDLE_CLS =
  'w-3.5! h-3.5! border-2! border-slate-900! bg-slate-50! shadow-[0_0_0_4px_rgba(15,23,42,0.35)]'
const TAG_CLS =
  'pointer-events-none text-[11px] leading-none text-slate-50 bg-slate-900/90 border border-slate-400/30 px-[7px] py-[3px] rounded-full shadow-[0_8px_20px_rgba(2,6,23,0.35)]'
const PORT_CLS =
  'absolute flex flex-col items-center gap-1 pointer-events-none'
const PANEL_CLS =
  'min-h-[calc(100vh-160px)] bg-slate-900/70 border border-slate-400/15 rounded-3xl backdrop-blur-lg shadow-[0_24px_80px_rgba(2,6,23,0.35)] max-[1200px]:min-h-[540px]'
const PANEL_BLOCK_CLS = 'mt-[18px] pt-[18px] border-t border-slate-400/15'
const H3_CLS = 'm-0 mb-3 text-slate-50'
const INPUT_CLS =
  'w-full mt-2 mb-3.5 rounded-[14px] border border-slate-400/20 bg-slate-900/90 px-3.5 py-3 text-slate-200 outline-none'
const OPTINPUT_CLS =
  'w-full rounded-[14px] border border-slate-400/20 bg-slate-900/90 px-3 py-2.5 text-slate-200 outline-none'
const GHOST_BTN_CLS =
  'border border-slate-400/20 bg-slate-800/80 text-slate-200 px-3 py-2.5 rounded-xl cursor-pointer'
const HELPER_CLS = 'text-xs text-slate-400 mt-2'
const PORT_BOTTOM_CLS = 'absolute flex flex-col items-center gap-1 pointer-events-none -translate-x-1/2'

const initialNodes = [
  {
    id: 'start-1',
    type: 'flowNode',
    position: { x: -72, y: -768 },
    data: {
      kind: 'start',
      label: 'Inbound Call',
      title: 'Main trunk',
      meta: { timeout: 20, playback: 'Welcome to Acme Support.' },
    },
  },
  {
    id: 'welcome-1',
    type: 'flowNode',
    position: { x: 240, y: -624 },
    data: {
      kind: 'menu',
      label: 'IVR Menu',
      title: 'Welcome',
      meta: { retries: 2, playback: 'welcome', fallback: '', timeout: 10, options: { '1': 'welcome-arabic-1', '2': 'welcome-english-1' } },
    },
  },
  {
    id: 'queue-support-arabic-1',
    type: 'flowNode',
    position: { x: 216, y: 696 },
    data: {
      kind: 'queue',
      label: 'Queue',
      title: 'support-arabic',
      queueName: 'support-arabic',
      meta: { strategy: 'rrordered', timeout: 30, playback: '' },
    },
  },
  {
    id: 'welcome-arabic-1',
    type: 'flowNode',
    position: { x: -120, y: 168 },
    data: {
      kind: 'menu',
      label: 'IVR Menu',
      title: 'Welcome Arabic',
      meta: { retries: 2, playback: 'welcome-arabic', fallback: '', timeout: 10, options: { '0': 'queue-support-arabic-1', '1': 'ext-1000' } },
    },
  },
  {
    id: 'welcome-english-1',
    type: 'flowNode',
    position: { x: 600, y: -456 },
    data: {
      kind: 'menu',
      label: 'IVR Menu',
      title: 'Welcome English',
      meta: { retries: 2, playback: 'welcome-english', fallback: '', timeout: 10, options: { '0': 'queue-support-english-1', '1': 'ext-1001' } },
    },
  },
  {
    id: 'queue-support-english-1',
    type: 'flowNode',
    position: { x: 888, y: 72 },
    data: {
      kind: 'queue',
      label: 'Queue',
      title: 'support-english',
      queueName: 'support-english',
      meta: { strategy: 'rrordered', timeout: 30, playback: '' },
    },
  },
  {
    id: 'ext-1001',
    type: 'flowNode',
    position: { x: 864, y: -120 },
    data: {
      kind: 'extension',
      label: 'Extension',
      title: '1001',
      meta: { extension: '1001', ringSeconds: 20, playback: '' },
    },
  },
  {
    id: 'ext-1000',
    type: 'flowNode',
    position: { x: 216, y: 504 },
    data: {
      kind: 'extension',
      label: 'Extension',
      title: '1000',
      meta: { extension: '1000', ringSeconds: 20, playback: '' },
    },
  },
  {
    id: 'goodbye-arabic-1',
    type: 'flowNode',
    position: { x: 216, y: 336 },
    data: {
      kind: 'playback',
      label: 'Playback',
      title: 'Goodbye Arabic',
      meta: { sound: 'good-bye-arabic' },
    },
  },
  {
    id: 'goodbye-english-1',
    type: 'flowNode',
    position: { x: 864, y: -264 },
    data: {
      kind: 'playback',
      label: 'Playback',
      title: 'Goodbye English',
      meta: { sound: 'good-bye-english' },
    },
  },
  {
    id: 'hangup-1',
    type: 'flowNode',
    position: { x: 1320, y: 336 },
    data: {
      kind: 'hangup',
      label: 'Hang Up',
      title: 'End call',
      meta: {},
    },
  },
]

const initialEdges = [
  { id: 'e-start-welcome', source: 'start-1', sourceHandle: 'next', target: 'welcome-1', ...EDGE_STYLE },
  { id: 'e-welcome-arabic', source: 'welcome-1', sourceHandle: 'option-1', target: 'welcome-arabic-1', ...EDGE_STYLE },
  { id: 'e-welcome-english', source: 'welcome-1', sourceHandle: 'option-2', target: 'welcome-english-1', ...EDGE_STYLE },
  { id: 'e-welcome-invalid', source: 'welcome-1', sourceHandle: 'option-invalid', target: 'goodbye-arabic-1', ...EDGE_STYLE },
  { id: 'e-welcome-timeout', source: 'welcome-1', sourceHandle: 'option-timeout', target: 'goodbye-arabic-1', ...EDGE_STYLE },
  { id: 'e-welcome-arabic-queue', source: 'welcome-arabic-1', sourceHandle: 'option-0', target: 'queue-support-arabic-1', ...EDGE_STYLE },
  { id: 'e-welcome-arabic-ext', source: 'welcome-arabic-1', sourceHandle: 'option-1', target: 'ext-1000', ...EDGE_STYLE },
  { id: 'e-welcome-arabic-invalid', source: 'welcome-arabic-1', sourceHandle: 'option-invalid', target: 'goodbye-arabic-1', ...EDGE_STYLE },
  { id: 'e-welcome-arabic-timeout', source: 'welcome-arabic-1', sourceHandle: 'option-timeout', target: 'goodbye-arabic-1', ...EDGE_STYLE },
  { id: 'e-welcome-english-queue', source: 'welcome-english-1', sourceHandle: 'option-0', target: 'queue-support-english-1', ...EDGE_STYLE },
  { id: 'e-welcome-english-ext', source: 'welcome-english-1', sourceHandle: 'option-1', target: 'ext-1001', ...EDGE_STYLE },
  { id: 'e-welcome-english-invalid', source: 'welcome-english-1', sourceHandle: 'option-invalid', target: 'goodbye-english-1', ...EDGE_STYLE },
  { id: 'e-welcome-english-timeout', source: 'welcome-english-1', sourceHandle: 'option-timeout', target: 'goodbye-english-1', ...EDGE_STYLE },
  { id: 'e-goodbye-arabic-hangup', source: 'goodbye-arabic-1', sourceHandle: 'next', target: 'hangup-1', ...EDGE_STYLE },
  { id: 'e-goodbye-english-hangup', source: 'goodbye-english-1', sourceHandle: 'next', target: 'hangup-1', ...EDGE_STYLE },
]

function createNode(kind, index) {
  const common = {
    id: `${kind}-${Date.now()}-${index}`,
    type: 'flowNode',
    position: { x: 140 + index * 28, y: 120 + index * 24 },
    data: {
      kind,
      label: NODE_TYPES[kind].label,
      title: `${NODE_TYPES[kind].label} ${index + 1}`,
      meta: {},
    },
  }

  if (kind === 'start') {
    common.data = { ...common.data, title: 'Inbound trunk', meta: { playback: 'Welcome', fallback: '', timeout: 20 } }
  }
  if (kind === 'menu') {
    common.data = { ...common.data, meta: { playback: 'Press 1 for sales, 2 for support, or 0 for operator.', fallback: '', retries: 2, timeout: 10, options: { '1': '', '2': '', '0': '' } } }
  }
  if (kind === 'extension') {
    common.data = { ...common.data, meta: { extension: '1000', ringSeconds: 20, playback: '' } }
  }
  if (kind === 'queue') {
    common.data = { ...common.data, queueName: 'support', meta: { strategy: 'rrordered', timeout: 30, playback: '' } }
  }
  if (kind === 'mixmonitor') {
    common.data = { ...common.data, title: 'Call recording', meta: { filename: 'calls/${UNIQUEID}.wav', options: 'a' } }
  }
  if (kind === 'audiosocket') {
    common.data = { ...common.data, title: 'Audio stream', meta: { destination: '127.0.0.1:9000', uuid: '${UNIQUEID}' } }
  }
  if (kind === 'webhook') {
    common.data = { ...common.data, title: 'Condition lookup', meta: { url: 'https://api.example.com/v1/condition?phone=${CALLERID(num)}', method: 'GET', responseVar: 'status' } }
  }
  if (kind === 'condition') {
    common.data = { ...common.data, title: 'Condition route', meta: { variable: 'status', operator: 'equals', expected: 'condition', trueLabel: 'condition', falseLabel: 'Non-condition' } }
  }
  if (kind === 'wait') {
    common.data = { ...common.data, title: 'Pause call', meta: { seconds: 5 } }
  }
  if (kind === 'waitexten') {
    common.data = { ...common.data, title: 'DTMF wait', meta: { seconds: 10, maxDigits: 1, playback: '' } }
  }
  if (kind === 'playback') {
    common.data = { ...common.data, title: 'Goodbye', meta: { sound: 'good-bye' } }
  }
  if (kind === 'noop') {
    common.data = { ...common.data, title: 'Log step', meta: { message: 'Checkpoint reached' } }
  }
  if (kind === 'set') {
    common.data = { ...common.data, title: 'Set variable', meta: { variable: 'CALL_TAG', value: 'support' } }
  }
  if (kind === 'readdigit') {
    common.data = { ...common.data, title: 'Read one digit', meta: { variable: 'IVR_DIGIT', timeout: 10, prompt: 'beep' } }
  }
  if (kind === 'hangup') {
    common.data = { ...common.data, title: 'End call' }
  }
  return common
}

function FlowNode({ data, selected }) {
  const config = NODE_TYPES[data.kind]
  const inputs = config.inputs || []
  const outputs = config.outputs || []
  const menuDigits = Object.keys(data.meta?.options || {})
  const menuPorts = [...menuDigits.map((digit) => ({ id: `option-${digit}`, label: digit, tone: 'default' })), { id: 'option-invalid', label: 'invalid', tone: 'red' }, { id: 'option-timeout', label: 'timeout', tone: 'amber' }]

  const metaByKind = {
    extension: { label: 'Extension', value: data.meta?.extension || 'n/a' },
    queue: { label: 'Queue', value: data.queueName || 'n/a' },
    mixmonitor: { label: 'File', value: data.meta?.filename || 'n/a' },
    audiosocket: { label: 'Dest', value: data.meta?.destination || 'n/a' },
    webhook: { label: 'Var', value: data.meta?.responseVar || 'n/a' },
    condition: { label: 'Rule', value: `${data.meta?.variable || 'n/a'} = ${data.meta?.expected || 'n/a'}` },
    menu: { label: 'Options', chips: menuDigits },
    start: { label: 'Fallback', value: data.meta?.fallback || 'unset' },
  }
  const meta = metaByKind[data.kind]
  const borderColor = `color-mix(in srgb, ${config.color} 45%, rgba(148,163,184,0.2))`
  const outlineColor = `color-mix(in srgb, ${config.color} 75%, white 10%)`

  return (
    <div
      className="relative min-w-55 px-4 pt-4 pb-3.5 rounded-[18px] bg-slate-900/95 text-slate-200 shadow-[0_18px_40px_rgba(2,6,23,0.45)]"
      style={{
        '--node-color': config.color,
        border: `1px solid ${borderColor}`,
        outline: selected ? `2px solid ${outlineColor}` : `1px solid ${outlineColor}`,
      }}
    >
      <header className="mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase mb-1.5" style={{ color: config.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
          {config.label}
        </span>
        <strong className="block">{data.title || config.label}</strong>
      </header>
      <p className="m-0 text-slate-300 text-[13px] leading-[1.45]">{data.meta?.playback || config.description}</p>
      {meta && (
        <div className="flex items-baseline gap-2 mt-3 pt-2.5 border-t border-slate-400/15">
          <span className="text-[10px] tracking-[0.08em] uppercase text-slate-500">{meta.label}</span>
          <span className="flex flex-wrap gap-1">
            {meta.chips?.join(', ')}
          </span>
        </div>
      )}
      {inputs.includes('in') && (
        <div className={`${PORT_CLS} -left-4.5 -translate-y-1/2`} style={{ top: '50%' }}>
          <span className={TAG_CLS}>in</span>
          <Handle className={`${HANDLE_CLS} -left-2!`} type="target" position={Position.Left} id="in" />
        </div>
      )}
      {data.kind === 'menu' &&
        menuPorts.map((port, index) => {
          const left = `${((index + 1) * 100) / (menuPorts.length + 1)}%`
          const toneCls =
            port.tone === 'red'
              ? 'text-red-200 bg-red-900/90 border-red-500/60'
              : port.tone === 'amber'
                ? 'text-amber-200 bg-amber-900/90 border-amber-500/60'
                : ''
          return (
            <div key={port.id} className={PORT_BOTTOM_CLS} style={{ left, bottom: '-0.75rem' }}>
              <span className={`${TAG_CLS} ${toneCls}`}>{port.label}</span>
              <Handle
                className={`${HANDLE_CLS} -bottom-2!`}
                type="source"
                position={Position.Bottom}
                id={port.id}
                title={port.label}
              />
            </div>
          )
        })}
      {data.kind === 'start' &&
        outputs.map((port) => (
          <div key={port} className={`${PORT_CLS} left-1/2 -translate-x-1/2`}>
            <span className={TAG_CLS}>{port}</span>
            <Handle className={`${HANDLE_CLS} -bottom-2!`} type="source" position={Position.Bottom} id={port} />
          </div>
        ))}
      {data.kind !== 'menu' && data.kind !== 'start' &&
        outputs.map((port, index) => {
          const top = outputs.length > 1 ? `${20 + index * 18}%` : '50%'
          return (
            <div key={port} className={`${PORT_CLS} -right-6 -translate-y-1/2`} style={{ top }}>
              <span className={TAG_CLS}>{port}</span>
              <Handle className={`${HANDLE_CLS} -bottom-2!`} type="source" position={Position.Right} id={port} />
            </div>
          )
        })}
    </div>
  )
}

function StrategySelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const active = options.find((option) => option.value === (value || ''))

  return (
    <div className="relative mt-2 mb-3.5">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-600/40 bg-slate-900/90 px-3.5 py-3 text-left text-slate-200"
        onClick={() => setOpen((openState) => !openState)}
      >
        <span>{active ? active.label : 'Select a strategy'}</span>
        <svg
          className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 right-0 z-30 mt-1.5 grid max-h-72 gap-1 overflow-auto rounded-2xl border border-slate-600/40 bg-slate-900 p-1.5 shadow-[0_24px_60px_rgba(2,6,23,0.5)]"
            role="listbox"
          >
            {options.map((option) => {
              const selected = option.value === (value || '')
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`grid w-full cursor-pointer gap-1 rounded-xl border px-3 py-2.5 text-left ${
                    selected
                      ? 'border-blue-500/60 bg-linear-to-br from-green-500/25 to-blue-500/25 text-white'
                      : 'border-transparent text-slate-200 hover:bg-blue-500/20'
                  }`}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {option.label}
                    <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {option.value}
                    </code>
                  </span>
                  <span className="text-xs text-slate-400">{option.behavior}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function MetaEditor({ kind, meta, onChange }) {
  const updateMeta = (key, value) => onChange({ ...(meta || {}), [key]: value })

  if (kind === 'start') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Playback
          <input className={INPUT_CLS} value={meta?.playback || ''} onChange={(e) => updateMeta('playback', e.target.value)} />
        </label>
        <label>
          Fallback target
          <input className={INPUT_CLS} value={meta?.fallback || ''} onChange={(e) => updateMeta('fallback', e.target.value)} />
        </label>
        <label>
          Timeout
          <input
            className={INPUT_CLS}
            type="number"
            value={meta?.timeout ?? ''}
            onChange={(e) => updateMeta('timeout', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      </div>
    )
  }

  if (kind === 'menu') {
    const options = meta?.options || {}
    const digits = Object.keys(options)
    const setOption = (oldDigit, nextDigit, target) => {
      const next = { ...options }
      if (oldDigit && oldDigit !== nextDigit) delete next[oldDigit]
      if (nextDigit) next[nextDigit] = target
      onChange({ ...meta, options: next })
    }
    const addOption = () => {
      let nextDigit = '1'
      while (options[nextDigit] !== undefined) nextDigit = String(Number(nextDigit) + 1)
      onChange({ ...meta, options: { ...options, [nextDigit]: '' } })
    }
    const removeOption = (digit) => {
      const next = { ...options }
      delete next[digit]
      onChange({ ...meta, options: next })
    }
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Playback
          <input className={INPUT_CLS} value={meta?.playback || ''} onChange={(e) => updateMeta('playback', e.target.value)} />
        </label>
        <label>
          Fallback target
          <input className={INPUT_CLS} value={meta?.fallback || ''} onChange={(e) => updateMeta('fallback', e.target.value)} />
        </label>
        <label>
          Retries
          <input
            className={INPUT_CLS}
            type="number"
            value={meta?.retries ?? ''}
            onChange={(e) => updateMeta('retries', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label>
          Timeout
          <input
            className={INPUT_CLS}
            type="number"
            value={meta?.timeout ?? ''}
            onChange={(e) => updateMeta('timeout', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <h3 className={H3_CLS}>Menu options</h3>
        {digits.map((digit) => (
          <div key={digit} className="grid grid-cols-[90px_1fr_auto] gap-2 items-center mb-2.5">
            <input
              className={OPTINPUT_CLS}
              value={digit}
              onChange={(e) => setOption(digit, e.target.value, options[digit])}
              placeholder="Digit"
            />
            <input
              className={OPTINPUT_CLS}
              value={options[digit] || ''}
              onChange={(e) => setOption(digit, digit, e.target.value)}
              placeholder="Target node id"
            />
            <button type="button" className={GHOST_BTN_CLS} onClick={() => removeOption(digit)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={GHOST_BTN_CLS} onClick={addOption}>
          Add option
        </button>
        <p className={HELPER_CLS}>Use the target node id from the canvas, like `extension-1` or `queue-1`.</p>
      </div>
    )
  }

  if (kind === 'extension') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Extension
          <input className={INPUT_CLS} value={meta?.extension || ''} onChange={(e) => updateMeta('extension', e.target.value)} />
        </label>
        <label>
          Playback
          <input className={INPUT_CLS} value={meta?.playback || ''} onChange={(e) => updateMeta('playback', e.target.value)} />
        </label>
        <label>
          Ring seconds
          <input
            className={INPUT_CLS}
            type="number"
            value={meta?.ringSeconds ?? ''}
            onChange={(e) => updateMeta('ringSeconds', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      </div>
    )
  }

  if (kind === 'queue') {
    const activeStrategy = QUEUE_STRATEGIES.find((strategy) => strategy.value === (meta?.strategy || ''))
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Playback
          <input className={INPUT_CLS} value={meta?.playback || ''} onChange={(e) => updateMeta('playback', e.target.value)} />
        </label>
        <label>
          Strategy
          <StrategySelect value={meta?.strategy || ''} options={QUEUE_STRATEGIES} onChange={(value) => updateMeta('strategy', value)} />
        </label>
        {activeStrategy && <p className={HELPER_CLS}>{activeStrategy.behavior}</p>}
        <label>
          Timeout
          <input
            className={INPUT_CLS}
            type="number"
            value={meta?.timeout ?? ''}
            onChange={(e) => updateMeta('timeout', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
      </div>
    )
  }

  if (kind === 'mixmonitor') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Filename
          <input className={INPUT_CLS} value={meta?.filename || ''} onChange={(e) => updateMeta('filename', e.target.value)} />
        </label>
        <label>
          Options
          <input className={INPUT_CLS} value={meta?.options || ''} onChange={(e) => updateMeta('options', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'audiosocket') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Destination
          <input className={INPUT_CLS} value={meta?.destination || ''} onChange={(e) => updateMeta('destination', e.target.value)} />
        </label>
        <label>
          UUID
          <input className={INPUT_CLS} value={meta?.uuid || ''} onChange={(e) => updateMeta('uuid', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'webhook') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          URL
          <input className={INPUT_CLS} value={meta?.url || ''} onChange={(e) => updateMeta('url', e.target.value)} />
        </label>
        <label>
          Method
          <input className={INPUT_CLS} value={meta?.method || ''} onChange={(e) => updateMeta('method', e.target.value)} />
        </label>
        <label>
          Response variable
          <input className={INPUT_CLS} value={meta?.responseVar || ''} onChange={(e) => updateMeta('responseVar', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'condition') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Variable
          <input className={INPUT_CLS} value={meta?.variable || ''} onChange={(e) => updateMeta('variable', e.target.value)} />
        </label>
        <label>
          Operator
          <input className={INPUT_CLS} value={meta?.operator || ''} onChange={(e) => updateMeta('operator', e.target.value)} />
        </label>
        <label>
          Expected value
          <input className={INPUT_CLS} value={meta?.expected || ''} onChange={(e) => updateMeta('expected', e.target.value)} />
        </label>
        <label>
          True label
          <input className={INPUT_CLS} value={meta?.trueLabel || ''} onChange={(e) => updateMeta('trueLabel', e.target.value)} />
        </label>
        <label>
          False label
          <input className={INPUT_CLS} value={meta?.falseLabel || ''} onChange={(e) => updateMeta('falseLabel', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'wait') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Seconds
          <input className={INPUT_CLS} type="number" value={meta?.seconds ?? ''} onChange={(e) => updateMeta('seconds', e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
      </div>
    )
  }

  if (kind === 'waitexten') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Playback
          <input className={INPUT_CLS} value={meta?.playback || ''} onChange={(e) => updateMeta('playback', e.target.value)} />
        </label>
        <label>
          Seconds
          <input className={INPUT_CLS} type="number" value={meta?.seconds ?? ''} onChange={(e) => updateMeta('seconds', e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
        <label>
          Max digits
          <input className={INPUT_CLS} type="number" value={meta?.maxDigits ?? ''} onChange={(e) => updateMeta('maxDigits', e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
      </div>
    )
  }

  if (kind === 'playback') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Sound
          <input className={INPUT_CLS} value={meta?.sound || ''} onChange={(e) => updateMeta('sound', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'noop') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Message
          <input className={INPUT_CLS} value={meta?.message || ''} onChange={(e) => updateMeta('message', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'set') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Variable
          <input className={INPUT_CLS} value={meta?.variable || ''} onChange={(e) => updateMeta('variable', e.target.value)} />
        </label>
        <label>
          Value
          <input className={INPUT_CLS} value={meta?.value || ''} onChange={(e) => updateMeta('value', e.target.value)} />
        </label>
      </div>
    )
  }

  if (kind === 'readdigit') {
    return (
      <div className={PANEL_BLOCK_CLS}>
        <h3 className={H3_CLS}>Meta</h3>
        <label>
          Variable
          <input className={INPUT_CLS} value={meta?.variable || ''} onChange={(e) => updateMeta('variable', e.target.value)} />
        </label>
        <label>
          Prompt
          <input className={INPUT_CLS} value={meta?.prompt || ''} onChange={(e) => updateMeta('prompt', e.target.value)} />
        </label>
        <label>
          Timeout
          <input className={INPUT_CLS} type="number" value={meta?.timeout ?? ''} onChange={(e) => updateMeta('timeout', e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
      </div>
    )
  }

  return null
}


function asAsteriskName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function nodeTargetName(node) {
  if (!node) return null
  const data = node.data || node
  if (data.kind === 'start') return 's'
  if (data.kind === 'menu') return asAsteriskName(data.title || node.id)
  if (data.kind === 'extension') return `ext-${data.meta?.extension || asAsteriskName(node.id)}`
  if (data.kind === 'queue') return `queue-${data.queueName || asAsteriskName(node.id)}`
  if (data.kind === 'mixmonitor') return `mixmonitor-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'audiosocket') return `audiosocket-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'webhook') return `webhook-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'condition') return `condition-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'wait') return `wait-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'waitexten') return `waitexten-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'playback') return `playback-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'noop') return `noop-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'set') return `set-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'readdigit') return `readdigit-${asAsteriskName(data.title || node.id)}`
  if (data.kind === 'hangup') return `hangup`
  return asAsteriskName(data.title || node.id)
}

function normalizeQueueStrategy(value) {
  const normalized = String(value || '').toLowerCase()
  const aliases = {
    ring_all: 'ringall',
    ringall: 'ringall',
    round_robin: 'rrordered',
    roundrobin: 'rrordered',
    leastrecent: 'leastrecent',
    fewestcalls: 'fewestcalls',
    random: 'random',
    rrmemory: 'rrmemory',
    rrordered: 'rrordered',
    linear: 'linear',
    wrandom: 'wrandom',
  }
  return aliases[normalized] || 'ringall'
}

function validateGraph(graph) {
  const errors = []
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const outgoing = buildOutgoingMap(graph.edges)
  const incoming = new Map()

  for (const edge of graph.edges) {
    if (!byId.has(edge.source)) errors.push(`Edge ${edge.id} references missing source node ${edge.source}.`)
    if (!byId.has(edge.target)) errors.push(`Edge ${edge.id} references missing target node ${edge.target}.`)
    if (!incoming.has(edge.target)) incoming.set(edge.target, [])
    incoming.get(edge.target).push(edge)
  }

  const startNodes = graph.nodes.filter((node) => node.data.kind === 'start')
  if (startNodes.length !== 1) errors.push('Exactly one Start node is required.')

  for (const node of graph.nodes) {
    const outs = outgoing.get(node.id) || []
    const ins = incoming.get(node.id) || []
    if (node.data.kind !== 'start' && ins.length === 0 && outs.length === 0) {
      errors.push(`Node ${node.id} is orphaned.`)
    }

    if (node.data.kind === 'start') {
      if (outs.length !== 1) errors.push('Start node has exactly one outgoing connection.')
      if (outs[0] && outs[0].sourceHandle !== 'next') errors.push('Start node must connect from its next output.')
    }

    if (node.data.kind === 'menu') {
      const options = node.data.meta?.options || {}
      const digits = Object.keys(options)
      if (digits.length === 0) errors.push(`Menu node ${node.id} requires at least one option.`)
      if (new Set(digits).size !== digits.length) errors.push(`Menu node ${node.id} has duplicate option digits.`)
      if (!outs.some((edge) => edge.sourceHandle === 'option-invalid')) {
        errors.push(`Menu node ${node.id} requires an invalid route.`)
      }
      if (!outs.some((edge) => edge.sourceHandle === 'option-timeout')) {
        errors.push(`Menu node ${node.id} requires a timeout route.`)
      }
    }

    if (node.data.kind === 'mixmonitor' && outs.length === 0) {
      errors.push('MixMonitor node requires an outgoing connection.')
    }

    if ((node.data.kind === 'wait' || node.data.kind === 'waitexten') && outs.length === 0) {
      errors.push(`${NODE_TYPES[node.data.kind].label} node requires an outgoing connection.`)
    }

    if ((node.data.kind === 'playback' || node.data.kind === 'noop' || node.data.kind === 'set' || node.data.kind === 'readdigit') && outs.length === 0) {
      errors.push(`${NODE_TYPES[node.data.kind].label} node requires an outgoing connection.`)
    }

    if (node.data.kind === 'queue' && !String(node.data.queueName || '').trim()) {
      errors.push(`Queue node ${node.id} requires a queue name.`)
    }

    if (node.data.kind === 'extension' && !String(node.data.meta?.extension || '').trim()) {
      errors.push(`Extension node ${node.id} requires an extension number.`)
    }
  }

  return errors
}

function buildOutgoingMap(edges) {
  const outgoing = new Map()
  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
    outgoing.get(edge.source).push(edge)
  }
  return outgoing
}

function normalizeGraph(nodes, edges) {
  return {
    version: 1,
    asterisk: {
      context: 'from-internal',
      trunk: 'main',
    },
    nodes: nodes,
    edges: edges.map(({ id, source, sourceHandle, target }) => ({ id, source, sourceHandle: sourceHandle || null, target })),
  }
}

function exportConfig(graph) {
  // eslint-disable-next-line no-unused-vars
  const normalized = normalizeGraph(graph.nodes, graph.edges)
  const outgoing = buildOutgoingMap(graph.edges)
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const startNode = graph.nodes.find((node) => node.data.kind === 'start')
  const startEdges = outgoing.get(startNode?.id || '') || []
  const entryTarget = byId.get(startEdges.find((edge) => edge.sourceHandle === 'next')?.target || '')

  const lines = []
  lines.push('; Generated by Asterisk Call Flow Builder')
  lines.push('; Drop this into /etc/asterisk/extensions.conf or an included custom file')
  lines.push('')
  lines.push('[from-internal]')
  lines.push('exten => s,1,NoOp(Inbound call from flow builder)')
  lines.push(' same => n,Answer()')
  if (startNode?.data.meta?.playback) lines.push(` same => n,Playback(${startNode.data.meta.playback})`)
  if (entryTarget) {
    lines.push(` same => n,Goto(${nodeTargetName(entryTarget)},s,1)`)
  } else {
    lines.push(' same => n,Hangup()')
  }
  lines.push('')

  for (const node of graph.nodes) {
    const name = nodeTargetName(node)
    const exits = outgoing.get(node.id) || []
    if (node.data.kind === 'start') continue

    lines.push(`[${name}]`)

    if (node.data.kind === 'menu') {
      lines.push(`exten => s,1,NoOp(${node.data.title || 'IVR menu'})`)
      if (node.data.meta?.playback) lines.push(` same => n,Playback(${node.data.meta.playback})`)
      lines.push(' same => n,Read(IVR_DIGIT,beep,1,,1,10)')
      const optionEdges = exits.filter((edge) => edge.sourceHandle?.startsWith('option-') && !['option-invalid', 'option-timeout'].includes(edge.sourceHandle))
      for (const edge of optionEdges) {
        const digit = edge.sourceHandle.replace('option-', '')
        const targetNode = byId.get(edge.target)
        if (!targetNode) continue
        lines.push(` same => n,GotoIf($["${'${IVR_DIGIT}'}"="${digit}"]?${nodeTargetName(targetNode)},s,1)`)
      }

      const invalidTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'option-invalid')?.target || '')
      const timeoutTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'option-timeout')?.target || '')
      if (timeoutTarget) lines.push(` same => n,GotoIf($["${'${IVR_DIGIT}'}"=""]?${nodeTargetName(timeoutTarget)},s,1)`)
      if (invalidTarget) lines.push(` same => n,Goto(${nodeTargetName(invalidTarget)},s,1)`)
      lines.push('')
      continue
    }

    if (node.data.kind === 'wait') {
      lines.push(`exten => s,1,NoOp(Wait ${node.data.meta?.seconds || 0}s)`)
      lines.push(` same => n,Wait(${node.data.meta?.seconds || 0})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      lines.push('')
      continue
    }

    if (node.data.kind === 'waitexten') {
      lines.push(`exten => s,1,NoOp(WaitExten ${node.data.meta?.seconds || 0}s)`)
      if (node.data.meta?.playback) lines.push(` same => n,Playback(${node.data.meta.playback})`)
      lines.push(` same => n,WaitExten(${node.data.meta?.seconds || 0})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'playback') {
      lines.push(`exten => s,1,NoOp(Playback ${node.data.meta?.sound || node.data.title || ''})`)
      lines.push(` same => n,Playback(${node.data.meta?.sound || 'good-bye'})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'noop') {
      lines.push(`exten => s,1,NoOp(${node.data.meta?.message || node.data.title || 'NoOp'})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'set') {
      const variable = node.data.meta?.variable || 'CALL_TAG'
      const value = node.data.meta?.value || ''
      lines.push(`exten => s,1,NoOp(Set ${variable}=${value})`)
      lines.push(` same => n,Set(${variable}=${value})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'readdigit') {
      const variable = node.data.meta?.variable || 'IVR_DIGIT'
      const prompt = node.data.meta?.prompt || 'beep'
      const timeout = node.data.meta?.timeout || 10
      const validTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'next')?.target || '')
      const invalidTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'invalid')?.target || '')
      const timeoutTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'timeout')?.target || '')
      lines.push(`exten => s,1,NoOp(Read one digit into ${variable})`)
      lines.push(` same => n,Read(${variable},${prompt},1,,1,${timeout})`)
      if (validTarget) lines.push(` same => n,Goto(${nodeTargetName(validTarget)},s,1)`)
      if (invalidTarget) lines.push(` same => n,Goto(${nodeTargetName(invalidTarget)},s,1)`)
      if (timeoutTarget) lines.push(` same => n,Goto(${nodeTargetName(timeoutTarget)},s,1)`)
      lines.push('')
      continue
    }

    if (node.data.kind === 'extension') {
      lines.push(`exten => s,1,NoOp(Ringing extension ${node.data.meta?.extension || ''})`)
      if (node.data.meta?.playback) lines.push(` same => n,Playback(${node.data.meta.playback})`)
      lines.push(` same => n,Dial(PJSIP/${node.data.meta?.extension || ''},${node.data.meta?.ringSeconds || 20})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'queue') {
      lines.push(`exten => s,1,NoOp(Queue ${node.data.queueName || ''})`)
      lines.push(` same => n,Queue(${node.data.queueName || ''})`)
      const queueStrategy = normalizeQueueStrategy(node.data.meta?.strategy)
      if (queueStrategy) lines.push(` same => n,NoOp(Queue strategy ${queueStrategy})`)
      const nextNode =
        byId.get(exits.find((edge) => edge.sourceHandle === 'answered')?.target || '') ||
        byId.get(exits.find((edge) => edge.sourceHandle === 'timeout')?.target || '') ||
        byId.get(exits.find((edge) => edge.sourceHandle === 'abandon')?.target || '') ||
        byId.get(exits.find((edge) => edge.sourceHandle === 'full')?.target || '') ||
        byId.get(exits.find((edge) => edge.sourceHandle === 'joinempty')?.target || '') ||
        byId.get(exits.find((edge) => edge.sourceHandle === 'leaveempty')?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      lines.push('')
      continue
    }

    if (node.data.kind === 'mixmonitor') {
      lines.push(`exten => s,1,NoOp(MixMonitor ${node.data.meta?.filename || ''})`)
      lines.push(` same => n,MixMonitor(${node.data.meta?.filename || 'call.wav'}${node.data.meta?.options ? `,${node.data.meta?.options}` : ''})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,NoOp(MixMonitor node requires an outgoing connection.)')
      lines.push('')
      continue
    }

    if (node.data.kind === 'audiosocket') {
      lines.push(`exten => s,1,NoOp(AudioSocket ${node.data.meta?.destination || ''})`)
      lines.push(` same => n,AudioSocket(${node.data.meta?.uuid || '${UNIQUEID}'},${node.data.meta?.destination || '127.0.0.1:9000'})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'webhook') {
      const responseVar = node.data.meta?.responseVar || 'WEBHOOK_RESULT'
      const url = node.data.meta?.url || ''
      lines.push(`exten => s,1,NoOp(Webhook ${url})`)
      lines.push(` same => n,Set(${responseVar}=${'${CURL(' + url + ')}'})`)
      const nextNode = byId.get(exits[0]?.target || '')
      if (nextNode) lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      else lines.push(' same => n,Hangup()')
      lines.push('')
      continue
    }

    if (node.data.kind === 'condition') {
      const variable = node.data.meta?.variable || 'WEBHOOK_RESULT'
      const expected = node.data.meta?.expected || 'condition'
      const operator = node.data.meta?.operator || 'equals'
      const trueTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'true')?.target || '')
      const falseTarget = byId.get(exits.find((edge) => edge.sourceHandle === 'false')?.target || '')
      lines.push(`exten => s,1,NoOp(Condition ${variable} ${operator} ${expected})`)
      if (trueTarget && falseTarget) {
        if (operator === 'contains') {
          lines.push(` same => n,GotoIf($[${'${' + variable + '}'} : "${expected}"]?${nodeTargetName(trueTarget)},s,1:${nodeTargetName(falseTarget)},s,1)`)
        } else {
          lines.push(` same => n,GotoIf($["${'${' + variable + '}'}"="${expected}"]?${nodeTargetName(trueTarget)},s,1:${nodeTargetName(falseTarget)},s,1)`)
        }
      } else if (trueTarget || falseTarget) {
        const nextNode = trueTarget || falseTarget
        lines.push(` same => n,Goto(${nodeTargetName(nextNode)},s,1)`)
      } else {
        lines.push(' same => n,Hangup()')
      }
      lines.push('')
      continue
    }

    if (node.data.kind === 'hangup') {
      lines.push('exten => s,1,Hangup()')
      lines.push('')
      continue
    }
  }

  // lines.push('; Normalized graph payload for app-side import/export')
  // lines.push('; ' + JSON.stringify(normalized))

  return lines.join('\n')
}

function downloadConfig(text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'extensions.conf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function App() {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [selectedId, setSelectedId] = useState(initialNodes[0].id)
  const [status, setStatus] = useState('Draft ready')
  const [showExport, setShowExport] = useState(false)
  const reactFlowWrapper = useRef(null)

  const selectedNode = nodes.find((node) => node.id === selectedId) || null
  const configText = useMemo(() => exportConfig({ nodes, edges }), [nodes, edges])

  const onNodesChange = (changes) => setNodes((current) => applyNodeChanges(changes, current))
  const onEdgesChange = (changes) => setEdges((current) => applyEdgeChanges(changes, current))
  const onSelectionChange = ({ nodes: selectedNodes }) => {
    setSelectedId(selectedNodes[0]?.id || null)
  }
  const onConnect = (connection) => {
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          ...EDGE_STYLE,
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        },
        current,
      ),
    )
  }

  const updateSelected = (patch) => {
    setNodes((current) => current.map((node) => (node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node)))
  }

  const updateMeta = (nextMeta) => {
    updateSelected({ meta: nextMeta })
  }

  const addNewNode = (kind) => {
    const next = createNode(kind, nodes.length)
    setNodes((current) => [...current, next])
    setSelectedId(next.id)
    setStatus(`Added ${NODE_TYPES[kind].label}`)
  }

  const onSave = () => setShowExport(true)

  const confirmExport = () => {
    const validationErrors = validateGraph({ nodes, edges })
    if (validationErrors.length > 0) {
      setStatus(validationErrors[0])
      setShowExport(false)
      return
    }
    downloadConfig(configText)
    setStatus('Exported ivr-flow.config')
    setShowExport(false)
  }

  return (
    <div className="min-h-screen text-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.15),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#08111f_0%,#0b1220_48%,#111827_100%)]">
      <header className="flex justify-between gap-6 px-7 pt-7 pb-4 items-end max-[1200px]:flex-col max-[1200px]:items-start">
        <div>
          <div className="uppercase tracking-[0.24em] text-slate-400 text-xs mb-2">Asterisk call routing</div>
          <h1 className="m-0 text-[clamp(32px,4vw,58px)] leading-[0.95] text-slate-50">Asterisk Call Flow Builder</h1>
          <p className="mt-3 max-w-180 text-slate-400">Design inbound flows, validate execution, and export an Asterisk `extensions.conf` file.</p>
        </div>
        <div className="flex flex-col items-end gap-3 max-[1200px]:items-start">
          <button type="button" className="border-0 cursor-pointer px-4.5 py-3.5 rounded-2xl bg-linear-to-br from-green-500 to-blue-500 text-white font-bold shadow-[0_12px_30px_rgba(59,130,246,0.24)]" onClick={onSave}>Export extensions.conf</button>
          <div className="border border-slate-400/25 bg-slate-900/70 px-3.5 py-2.5 rounded-full text-slate-300">{status}</div>
        </div>
      </header>

      <main className="grid grid-cols-[280px_1fr_340px] gap-4 px-4 pb-4 max-[1200px]:grid-cols-1">
        <aside className={`${PANEL_CLS} p-4.5 overflow-auto`}>
          <h2 className="m-0 mb-4 text-slate-50">Palette</h2>
          {Object.entries(NODE_TYPES).map(([kind, meta]) => (
            <button key={kind} type="button" className="w-full flex gap-3 text-left p-3 rounded-[18px] bg-slate-800/70 text-slate-200 mb-2.5 border-0 cursor-pointer" onClick={() => addNewNode(kind)}>
              <span className="w-3 h-3 rounded-full mt-1.25 shadow-[0_0_0_6px_rgba(255,255,255,0.04)]" style={{ background: meta.color }} />
              <span>
                <strong className="block">{meta.label}</strong>
                <small className="text-slate-400">{meta.description}</small>
              </span>
            </button>
          ))}
          
        </aside>

        <section
          className={`${PANEL_CLS} p-0 overflow-hidden [&_.react-flow__background]:bg-[linear-gradient(180deg,rgba(8,17,31,0.92),rgba(15,23,42,0.96))] [&_.react-flow__controls]:bg-slate-900/90! [&_.react-flow__controls]:border! [&_.react-flow__controls]:border-slate-400/15! [&_.react-flow__mini-map]:bg-slate-900/90! [&_.react-flow__mini-map]:border! [&_.react-flow__mini-map]:border-slate-400/15!`}
          ref={reactFlowWrapper}
        >
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={{ flowNode: FlowNode }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onSelectionChange={onSelectionChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              connectionMode="loose"
              defaultEdgeOptions={EDGE_STYLE}
              edgesFocusable
              nodesFocusable
              nodesConnectable
              elementsSelectable
              fitView
              snapToGrid
              snapGrid={[24, 24]}
            >
              <Background gap={24} size={1} />
              <Controls />
              <MiniMap zoomable pannable nodeStrokeColor={(node) => NODE_TYPES[node.data.kind]?.color || '#94a3b8'} />
            </ReactFlow>
          </ReactFlowProvider>
        </section>

        <aside className={`${PANEL_CLS} p-4.5 overflow-auto`}>
          <h2 className="m-0 mb-4 text-slate-50">Inspector</h2>
          {selectedNode ? (
            <>
              <label>
                Title
                <input className={INPUT_CLS} value={selectedNode.data.title || ''} onChange={(e) => updateSelected({ title: e.target.value })} />
              </label>
              {'queueName' in selectedNode.data && (
                <label>
                  Queue name
                  <input className={INPUT_CLS} value={selectedNode.data.queueName || ''} onChange={(e) => updateSelected({ queueName: e.target.value })} />
                </label>
              )}
              <MetaEditor kind={selectedNode.data.kind} meta={selectedNode.data.meta} onChange={updateMeta} />
            </>
          ) : (
            <p className="text-slate-400">Select a node to edit its properties.</p>
          )}
        </aside>
      </main>

      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setShowExport(false)}
        >
          <div
            className="w-full max-w-350 max-h-[90vh] flex flex-col bg-slate-900 border border-slate-400/15 rounded-3xl shadow-[0_24px_80px_rgba(2,6,23,0.5)] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-400/15">
              <div>
                <div className="uppercase tracking-[0.24em] text-slate-400 text-xs mb-1">extensions.conf</div>
                <h2 className="m-0 text-slate-50">Export preview</h2>
              </div>
              <div className="flex gap-2">
                <button type="button" className={GHOST_BTN_CLS} onClick={() => setShowExport(false)}>Close</button>
                <button type="button" className="border-0 cursor-pointer px-4 py-2.5 rounded-xl bg-linear-to-br from-green-500 to-blue-500 text-white font-bold" onClick={confirmExport}>Download extensions.conf</button>
              </div>
            </div>
            <div className="overflow-auto p-6">
              <pre className="m-0 overflow-auto rounded-2xl bg-slate-950/60 p-4 text-xs text-slate-400 whitespace-pre-wrap wrap-break-word">{configText}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
