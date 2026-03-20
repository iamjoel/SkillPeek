import { cn } from "@my-better-t-app/ui/lib/utils";
import {
  BaseEdge,
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";

import type { ExampleFlowEdge, ExampleFlowNode } from "@/components/types";

const flowNodeTypes = {
  step: StepFlowNode,
  decision: DecisionFlowNode,
} satisfies NodeTypes;

const flowEdgeTypes = {
  annotated: AnnotatedFlowEdge,
} satisfies EdgeTypes;

export function FlowCanvas({
  nodes,
  edges,
  heightClassName,
  interactive = false,
}: {
  nodes: ExampleFlowNode[];
  edges: ExampleFlowEdge[];
  heightClassName: string;
  interactive?: boolean;
}) {
  return (
    <div className={cn("w-full", heightClassName)}>
      <ReactFlow<ExampleFlowNode, ExampleFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        edgeTypes={flowEdgeTypes}
        fitView
        fitViewOptions={{ padding: interactive ? 0.08 : 0.28 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={interactive}
        zoomOnDoubleClick={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        minZoom={0.35}
        maxZoom={1.8}
        preventScrolling={!interactive}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.35}
          color="rgba(100, 116, 139, 0.38)"
        />
        {interactive ? (
          <Controls
            position="bottom-left"
            showInteractive={false}
            className="!rounded-2xl !border !border-slate-200 !bg-white/96 !shadow-[0_12px_30px_rgba(148,163,184,0.2)]"
          />
        ) : null}
      </ReactFlow>
    </div>
  );
}

function StepFlowNode({ data }: NodeProps<ExampleFlowNode>) {
  return (
    <div className="relative rounded-[12px] border border-slate-200/90 bg-white px-2.5 py-1.5 text-center text-[11px] font-semibold text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.18)]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-2 !border-white !bg-slate-400" />
      <span className="leading-4">{data.label}</span>
    </div>
  );
}

function DecisionFlowNode({ data }: NodeProps<ExampleFlowNode>) {
  return (
    <div className="relative size-[72px]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-slate-400" />
      <Handle
        id="branch-top"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-400"
        style={{ top: "18%" }}
      />
      <Handle
        id="branch-mid"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-400"
        style={{ top: "50%" }}
      />
      <Handle
        id="branch-bottom"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-400"
        style={{ top: "82%" }}
      />
      <div className="absolute inset-2 rotate-45 rounded-[12px] border border-slate-200/90 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.18)]" />
      <div className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] font-semibold leading-4 text-slate-700">
        {data.label}
      </div>
    </div>
  );
}

function AnnotatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  data,
}: EdgeProps<ExampleFlowEdge>) {
  const isLoopBack = data?.route === "loop-back" && targetX < sourceX;
  const lift = data?.lift ?? 64;
  const [edgePath, labelX, labelY] = isLoopBack
    ? (() => {
        const loopTopY = Math.min(sourceY, targetY) - lift;
        const exitX = sourceX + 18;
        const entryX = targetX - 18;
        const path = [
          `M ${sourceX} ${sourceY}`,
          `L ${exitX} ${sourceY}`,
          `L ${exitX} ${loopTopY}`,
          `L ${entryX} ${loopTopY}`,
          `L ${entryX} ${targetY}`,
          `L ${targetX} ${targetY}`,
        ].join(" ");

        return [path, (exitX + entryX) / 2, loopTopY] as const;
      })()
    : getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 18,
      });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full border border-slate-200 bg-white/96 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-700 shadow-[0_6px_18px_rgba(148,163,184,0.18)]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + (data?.labelOffsetX ?? 0)}px, ${
                labelY + (data?.labelOffsetY ?? 0)
              }px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
