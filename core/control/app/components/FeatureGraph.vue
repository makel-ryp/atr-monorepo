<script setup lang="ts">
const props = defineProps<{
  features: { slug: string, has_knowledge: boolean }[]
  edges: { from: string, to: string, type: string }[]
}>()

const router = useRouter()

const width = 600
const height = 400
const nodeRadius = 28

const nodes = computed(() => {
  const count = props.features.length
  if (count === 0) return []
  if (count === 1) {
    return [{ ...props.features[0], x: width / 2, y: height / 2 }]
  }

  const cx = width / 2
  const cy = height / 2
  const rx = width / 2 - 60
  const ry = height / 2 - 50

  return props.features.map((f, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      ...f,
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle)
    }
  })
})

const nodeMap = computed(() => {
  const map = new Map<string, { x: number, y: number }>()
  for (const n of nodes.value) {
    map.set(n.slug, { x: n.x, y: n.y })
  }
  return map
})

const links = computed(() => {
  return props.edges
    .filter(e => nodeMap.value.has(e.from) && nodeMap.value.has(e.to))
    .map(e => {
      const from = nodeMap.value.get(e.from)!
      const to = nodeMap.value.get(e.to)!

      // Calculate angle and offset by node radius for arrow
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const nx = dx / dist
      const ny = dy / dist

      return {
        ...e,
        x1: from.x + nx * nodeRadius,
        y1: from.y + ny * nodeRadius,
        x2: to.x - nx * (nodeRadius + 6),
        y2: to.y - ny * (nodeRadius + 6)
      }
    })
})

function edgeColor(type: string) {
  return type === 'contains' ? 'var(--ui-color-primary)' : 'var(--ui-color-muted)'
}
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="w-full max-h-80">
    <defs>
      <marker id="arrow-uses" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6" fill="var(--ui-color-muted)" />
      </marker>
      <marker id="arrow-contains" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6" fill="var(--ui-color-primary)" />
      </marker>
    </defs>

    <!-- Edges -->
    <line
      v-for="(link, i) in links"
      :key="`edge-${i}`"
      :x1="link.x1"
      :y1="link.y1"
      :x2="link.x2"
      :y2="link.y2"
      :stroke="edgeColor(link.type)"
      stroke-width="1.5"
      :marker-end="`url(#arrow-${link.type})`"
      opacity="0.6"
    />

    <!-- Nodes -->
    <g
      v-for="node in nodes"
      :key="node.slug"
      class="cursor-pointer"
      @click="router.push(`/features/${node.slug}`)"
    >
      <circle
        :cx="node.x"
        :cy="node.y"
        :r="nodeRadius"
        :fill="node.has_knowledge ? 'var(--ui-color-primary)' : 'var(--ui-bg-elevated)'"
        :stroke="node.has_knowledge ? 'var(--ui-color-primary)' : 'var(--ui-border-default)'"
        stroke-width="2"
        :opacity="node.has_knowledge ? 0.15 : 1"
      />
      <circle
        :cx="node.x"
        :cy="node.y"
        :r="nodeRadius"
        fill="transparent"
        :stroke="node.has_knowledge ? 'var(--ui-color-primary)' : 'var(--ui-border-default)'"
        stroke-width="2"
        class="hover:stroke-[3]"
      />
      <text
        :x="node.x"
        :y="node.y"
        text-anchor="middle"
        dominant-baseline="central"
        class="text-[9px] fill-current pointer-events-none"
      >
        {{ node.slug.length > 12 ? node.slug.slice(0, 11) + '…' : node.slug }}
      </text>
    </g>

    <!-- Legend -->
    <g transform="translate(10, 370)">
      <line x1="0" y1="0" x2="20" y2="0" stroke="var(--ui-color-muted)" stroke-width="1.5" marker-end="url(#arrow-uses)" opacity="0.6" />
      <text x="26" y="4" class="text-[9px] fill-muted">uses</text>
      <line x1="70" y1="0" x2="90" y2="0" stroke="var(--ui-color-primary)" stroke-width="1.5" marker-end="url(#arrow-contains)" opacity="0.6" />
      <text x="96" y="4" class="text-[9px] fill-muted">contains</text>
      <circle cx="160" cy="0" r="5" fill="var(--ui-color-primary)" opacity="0.15" stroke="var(--ui-color-primary)" stroke-width="1.5" />
      <text x="170" y="4" class="text-[9px] fill-muted">documented</text>
    </g>
  </svg>
</template>
