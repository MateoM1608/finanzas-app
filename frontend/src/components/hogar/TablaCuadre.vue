<script setup>
import { computed } from 'vue';
import { formatCurrency, formatDate } from '../../utils/format.js';

/**
 * Cuadro de un cuadre: cada gasto con quién lo pagó y cuánto le corresponde
 * a cada miembro (una columna por persona, sirve para N miembros), y al final
 * por persona lo que pagó, lo que le correspondía y su saldo. Solo cuentan
 * los ítems incluidos (en un cuadre cerrado, todos).
 */
const props = defineProps({
  grupos: { type: Array, required: true }, // [{ id, titulo?, items }]
  seleccionable: { type: Boolean, default: false },
  puedeMarcar: { type: Boolean, default: false },
  marcandoId: { type: String, default: null },
  compacto: { type: Boolean, default: false },
});
const emit = defineEmits(['marcar']);

const todos = computed(() => props.grupos.flatMap((g) => g.items));
const incluido = (item) => item.incluido !== false;

// Personas del cuadre: quienes pagaron o tienen parte, en orden alfabético.
const miembros = computed(() => {
  const nombres = new Map();
  for (const item of todos.value) {
    if (item.pagador) nombres.set(item.pagador.id, item.pagador.nombre);
    for (const r of item.repartos ?? []) nombres.set(r.usuarioId, r.usuario?.nombre ?? '—');
  }
  return [...nombres.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
});

const parteDe = (item, usuarioId) => (item.repartos ?? []).find((r) => r.usuarioId === usuarioId)?.monto ?? 0;

const resumen = computed(() =>
  miembros.value.map((m) => {
    let pago = 0;
    let corresponde = 0;
    for (const item of todos.value) {
      if (!incluido(item)) continue;
      if (item.pagador?.id === m.id) pago += item.monto;
      corresponde += parteDe(item, m.id);
    }
    return { ...m, pago, corresponde, saldo: pago - corresponde };
  }),
);
const totalIncluido = computed(() => todos.value.filter(incluido).reduce((a, i) => a + i.monto, 0));
</script>

<template>
  <div class="space-y-4">
    <div v-for="grupo in grupos" :key="grupo.id">
      <p v-if="grupo.titulo" class="mb-1 text-[13px] font-medium text-ink-secondary">{{ grupo.titulo }}</p>
      <div class="-mx-1 overflow-x-auto px-1">
        <table class="w-full border-collapse text-left" :class="compacto ? 'text-xs' : 'text-[13px]'">
          <thead>
            <tr class="border-b border-border text-ink-tertiary">
              <th scope="col" class="py-2 pr-3 font-medium">Gasto</th>
              <th scope="col" class="whitespace-nowrap py-2 px-3 text-right font-medium">Pagó</th>
              <th
                v-for="m in miembros"
                :key="m.id"
                scope="col"
                class="whitespace-nowrap py-2 pl-3 text-right font-medium"
              >
                {{ m.nombre }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in grupo.items"
              :key="item.id"
              class="border-b border-border/60 last:border-0 align-top"
              :class="{ 'opacity-50': !incluido(item) }"
            >
              <td class="py-2.5 pr-3">
                <label class="flex min-w-[9rem] items-start gap-2.5" :class="{ 'cursor-pointer': seleccionable }">
                  <input
                    v-if="seleccionable"
                    type="checkbox"
                    class="checkbox mt-0.5 shrink-0"
                    :checked="incluido(item)"
                    :disabled="!puedeMarcar || marcandoId === item.id"
                    :aria-label="`Incluir ${item.nombre}`"
                    @change="emit('marcar', item)"
                  />
                  <span class="min-w-0">
                    <span class="block font-medium text-ink-primary" :class="{ 'line-through': !incluido(item) }">{{ item.nombre }}</span>
                    <span class="block text-ink-tertiary">{{ formatDate(item.fecha) }}</span>
                  </span>
                </label>
              </td>
              <td class="whitespace-nowrap py-2.5 px-3 text-right">
                <span class="block font-semibold text-ink-primary">{{ formatCurrency(item.monto) }}</span>
                <span class="block text-ink-tertiary">{{ item.pagador?.nombre ?? '—' }}</span>
              </td>
              <td v-for="m in miembros" :key="m.id" class="whitespace-nowrap py-2.5 pl-3 text-right text-ink-secondary">
                {{ parteDe(item, m.id) ? formatCurrency(parteDe(item, m.id)) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left text-xs sm:text-[13px]">
        <caption class="mb-1 text-left text-[13px] font-medium text-ink-secondary">
          Por persona · {{ formatCurrency(totalIncluido) }} en total
        </caption>
        <thead>
          <tr class="border-b border-border text-ink-tertiary">
            <th scope="col" class="py-2 pr-2 font-medium">Persona</th>
            <th scope="col" class="whitespace-nowrap py-2 px-2 text-right font-medium">Pagó</th>
            <th scope="col" class="py-2 px-2 text-right font-medium">Le corresponde</th>
            <th scope="col" class="whitespace-nowrap py-2 pl-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in resumen" :key="r.id" class="border-b border-border/60 last:border-0">
            <th scope="row" class="py-2 pr-2 font-medium text-ink-primary">{{ r.nombre }}</th>
            <td class="whitespace-nowrap py-2 px-2 text-right text-ink-primary">{{ formatCurrency(r.pago) }}</td>
            <td class="whitespace-nowrap py-2 px-2 text-right text-ink-primary">{{ formatCurrency(r.corresponde) }}</td>
            <td
              class="whitespace-nowrap py-2 pl-2 text-right"
              :class="r.saldo > 0 ? 'text-positive' : r.saldo < 0 ? 'text-negative' : 'text-ink-tertiary'"
            >
              <span class="block font-semibold">{{ r.saldo ? formatCurrency(Math.abs(r.saldo)) : '$ 0' }}</span>
              <span class="block text-[11px]">{{ r.saldo > 0 ? 'le deben' : r.saldo < 0 ? 'debe' : 'a paz y salvo' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
