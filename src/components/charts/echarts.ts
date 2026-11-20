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
import { chart, color, font } from '@/theme/tokens';

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

export const THEME = 'helphive';

const axis = {
    axisLine: { show: true, lineStyle: { color: color.lineStrong } },
    axisTick: { show: false },
    axisLabel: { color: chart.axis, fontSize: 11, fontWeight: 600 },
    splitLine: { show: true, lineStyle: { color: chart.grid, type: 'solid' } },
    nameTextStyle: { color: chart.axis, fontSize: 11 },
};

// Theme built from the design tokens: recessive axes and grid, ink tooltips, the fixed palette.
// ECharts 6 changed several defaults the tokens do not cover (grid box, colour-scale padding,
// legend gap, bar gap, axis pointer colours, tooltip fade, graph edge colour); they are set back
// to the ECharts 5 values below so every chart keeps the look it had.
echarts.registerTheme(THEME, {
    grid: { left: '10%', top: 60, bottom: 70 },
    visualMap: { padding: 5 },
    axisPointer: {
        lineStyle: { color: '#B9BEC9' },
        shadowStyle: { color: 'rgba(210,219,238,0.2)' },
        label: { backgroundColor: 'auto', color: '#fff' },
    },
    graph: { lineStyle: { color: '#aaa' } },
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
    tooltip: {
        displayTransition: false,
        backgroundColor: color.ink900,
        borderWidth: 0,
        padding: [6, 10],
        textStyle: { color: '#FFFFFF', fontSize: 12, fontWeight: 600 },
        extraCssText: 'border-radius:6px;box-shadow:0 12px 32px -12px rgba(16,24,40,.35);',
    },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: { ...axis, splitLine: { show: false } },
    line: { symbolSize: 8, lineStyle: { width: 2 }, smooth: false },
    bar: { defaultBarGap: '20%', itemStyle: { borderRadius: [4, 4, 0, 0] } },
});

export { echarts };
export type { EChartsCoreOption } from 'echarts/core';
