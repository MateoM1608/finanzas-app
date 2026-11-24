import { computed } from 'vue';
import { useTheme } from './useTheme.js';
import { formatCurrency } from '../utils/format.js';

// Colores y opciones de Chart.js que siguen el tema activo. Las opciones son
// `computed`: al cambiar de tema, vue-chartjs vuelve a dibujar con la paleta nueva.
const PALETAS = {
  light: {
    series: ['#294AD1', '#0E8A7E', '#C4840F', '#CD2D3B', '#7A55D6', '#2B8FCF'],
    soft: '#A9B8F0',
    grid: 'rgba(17,21,26,0.06)',
    ticks: '#8A9197',
    text: '#586068',
    tooltipBg: '#11151A',
    tooltipText: '#F4F5F1',
    surface: '#FFFFFF',
  },
  dark: {
    series: ['#7691FF', '#3DCCB4', '#F0B648', '#FF707A', '#A78BFA', '#5CB8F0'],
    soft: '#3B4A85',
    grid: 'rgba(234,237,242,0.07)',
    ticks: '#6E7684',
    text: '#9DA4B1',
    tooltipBg: '#EAEDF2',
    tooltipText: '#0B0D11',
    surface: '#12151B',
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
      titleFont: { family: 'Geist', weight: '600' },
      bodyFont: { family: 'Geist' },
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
        font: { family: 'Geist', size: 12 },
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
        ticks: { color: p.ticks, font: { family: 'Geist', size: 11 } },
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
