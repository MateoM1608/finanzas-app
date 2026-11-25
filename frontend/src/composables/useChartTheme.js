import { computed } from 'vue';
import { useTheme } from './useTheme.js';
import { formatCurrency } from '../utils/format.js';

// Colores y opciones de Chart.js que siguen el tema activo. Las opciones son
// `computed`: al cambiar de tema, vue-chartjs vuelve a dibujar con la paleta nueva.
const PALETAS = {
  light: {
    series: ['#145232', '#4FB04C', '#C98A1A', '#C2462E', '#3E8C8A', '#8A6FBF'],
    soft: '#B9D9BF',
    grid: 'rgba(14,36,24,0.07)',
    ticks: '#6C796F',
    text: '#485A4E',
    tooltipBg: '#0F3622',
    tooltipText: '#F6EFE3',
    surface: '#FFFBF4',
  },
  dark: {
    series: ['#6EE26B', '#F2C262', '#5CC8B8', '#FF8C7A', '#B59CF0', '#A8DDA6'],
    soft: '#2E5E42',
    grid: 'rgba(246,239,227,0.07)',
    ticks: '#8DA495',
    text: '#B9CCBD',
    tooltipBg: '#F6EFE3',
    tooltipText: '#0A2416',
    surface: '#0F2E1D',
  },
};

export function useChartTheme() {
  const { tema } = useTheme();
  const paleta = computed(() => PALETAS[tema.value] ?? PALETAS.light);

  function tooltip(p) {
    return {
      backgroundColor: p.tooltipBg,
      titleColor: p.tooltipText,
      bodyColor: p.tooltipText,
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
      boxPadding: 4,
      titleFont: { family: 'Plus Jakarta Sans', weight: '600' },
      bodyFont: { family: 'Plus Jakarta Sans' },
      callbacks: {
        label: (ctx) => {
          const valor = ctx.parsed?.y ?? ctx.parsed;
          const nombre = ctx.dataset.label || ctx.label;
          return ` ${nombre ? `${nombre}: ` : ''}${formatCurrency(valor)}`;
        },
      },
    };
  }

  function leyenda(p) {
    return {
      position: 'bottom',
      labels: {
        color: p.text,
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        boxHeight: 8,
        padding: 14,
        font: { family: 'Plus Jakarta Sans', size: 12 },
      },
    };
  }

  /** Barras: ejes discretos, montos abreviados en el eje Y. */
  function opcionesBarras({ apilado = false, conLeyenda = false } = {}) {
    return computed(() => {
      const p = paleta.value;
      const eje = {
        stacked: apilado,
        border: { display: false },
        ticks: { color: p.ticks, font: { family: 'Plus Jakarta Sans', size: 11 } },
      };
      return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: conLeyenda ? leyenda(p) : { display: false }, tooltip: tooltip(p) },
        scales: {
          x: { ...eje, grid: { display: false } },
          y: {
            ...eje,
            grid: { color: p.grid },
            ticks: {
              ...eje.ticks,
              maxTicksLimit: 5,
              callback: (v) => new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
            },
          },
        },
      };
    });
  }

  /** Dona: hueco amplio y bordes del color de la tarjeta para separar segmentos. */
  function opcionesDona() {
    return computed(() => {
      const p = paleta.value;
      return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: leyenda(p), tooltip: tooltip(p) },
      };
    });
  }

  return { paleta, opcionesBarras, opcionesDona };
}
