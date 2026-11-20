// The only module that imports ECharts. It registers just the pieces the console uses, so the
// bundle carries those and not the whole library. Add a chart type here before using it.
import * as echarts from 'echarts/core';
import { BarChart, GraphChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts';
import {
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TitleComponent,
    TooltipComponent,
    VisualMapComponent,
} from 'echarts/components';
import { LegacyGridContainLabel } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';
import { chart, color, font, palettes, rawColor, type Scheme } from '@/theme/tokens';

echarts.use([
    // ECharts 6 lays `grid.containLabel` out the new way unless this is registered; the charts
    // here rely on the ECharts 5 layout.
    LegacyGridContainLabel,
    BarChart,
    GraphChart,
    HeatmapChart,
    LineChart,
    PieChart,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TitleComponent,
    TooltipComponent,
    VisualMapComponent,
    SVGRenderer,
]);

/** The registered ECharts theme for a colour scheme. */
export const themeName = (scheme: Scheme) => `helphive-${scheme}`;

/**
 * ECharts draws SVG with real colours, so every token reference (`var(--hh-...)`) in an option is
 * turned into the colour of the scheme on screen. Walks plain objects and arrays; leaves the rest.
 */
export function resolveColors<T>(value: T, scheme: Scheme): T {
    if (typeof value === 'string') return rawColor(value, scheme) as T;
    if (Array.isArray(value)) return value.map((v) => resolveColors(v, scheme)) as T;
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, resolveColors(v, scheme)])
        ) as T;
    }
    return value;
}

// Theme built from the design tokens: recessive axes and grid, ink tooltips, the fixed palette.
// ECharts 6 changed several defaults the tokens do not cover (grid box, colour-scale padding,
// legend gap, bar gap, axis pointer colours, tooltip fade, graph edge colour); on light they are set
// back to the ECharts 5 values so every chart keeps the look it had. Dark uses token equivalents.
function themeFor(scheme: Scheme) {
    const p = palettes[scheme];
    const dark = scheme === 'dark';
    const axis = {
        axisLine: { show: true, lineStyle: { color: color.lineStrong } },
        axisTick: { show: false },
        axisLabel: { color: chart.axis, fontSize: 11, fontWeight: 600 },
        splitLine: { show: true, lineStyle: { color: chart.grid, type: 'solid' } },
        nameTextStyle: { color: chart.axis, fontSize: 11 },
    };
    return resolveColors(
        {
            grid: { left: '10%', top: 60, bottom: 70 },
            visualMap: { padding: 5 },
            axisPointer: {
                lineStyle: { color: dark ? p.ink300 : '#B9BEC9' },
                shadowStyle: { color: dark ? 'rgba(242,244,247,0.05)' : 'rgba(210,219,238,0.2)' },
                label: { backgroundColor: 'auto', color: '#fff' },
            },
            graph: { lineStyle: { color: dark ? p.ink300 : '#aaa' } },
            color: [...chart.categorical],
            backgroundColor: 'transparent',
            textStyle: { fontFamily: font.family, color: chart.text },
            title: { textStyle: { color: color.ink900 } },
            legend: {
                textStyle: { color: color.ink600, fontSize: 12, fontWeight: 600 },
                itemWidth: 10,
                itemHeight: 10,
                itemGap: 10,
                icon: 'roundRect',
            },
            // An ink slab on light; on dark a raised layer with a hairline (an ink fill there would
            // be a near-white box).
            tooltip: {
                displayTransition: false,
                backgroundColor: dark ? p.raised : p.inkFill,
                borderWidth: dark ? 1 : 0,
                borderColor: dark ? p.lineStrong : 'transparent',
                padding: [6, 10],
                textStyle: { color: dark ? p.ink900 : p.onInk, fontSize: 12, fontWeight: 600 },
                extraCssText: dark
                    ? 'border-radius:6px;box-shadow:0 16px 40px -12px rgba(0,0,0,.7);'
                    : 'border-radius:6px;box-shadow:0 12px 32px -12px rgba(16,24,40,.35);',
            },
            categoryAxis: { ...axis, splitLine: { show: false } },
            valueAxis: { ...axis, axisLine: { show: false } },
            timeAxis: { ...axis, splitLine: { show: false } },
            line: { symbolSize: 8, lineStyle: { width: 2 }, smooth: false },
            bar: { defaultBarGap: '20%', itemStyle: { borderRadius: [4, 4, 0, 0] } },
        },
        scheme
    );
}

echarts.registerTheme(themeName('light'), themeFor('light'));
echarts.registerTheme(themeName('dark'), themeFor('dark'));

export { echarts };
export type { EChartsCoreOption } from 'echarts/core';
