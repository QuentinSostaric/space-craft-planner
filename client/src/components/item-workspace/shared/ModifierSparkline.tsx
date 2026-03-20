import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type { GppModifier } from '../../../types';

interface ModifierSparklineProps {
  modifier: GppModifier;
  width?: number;
  height?: number;
}

export function ModifierSparkline({
  modifier,
  width = 60,
  height = 20,
}: ModifierSparklineProps) {
  const { qualityStart, qualityEnd, modAtMin, modAtMax } = modifier;

  // Normalize to SVG coordinates
  const x1 = (qualityStart / 1000) * width;
  const x2 = (qualityEnd / 1000) * width;

  // Y axis: invert (SVG y=0 is top), normalize around 1.0
  const minMod = Math.min(modAtMin, modAtMax, 1);
  const maxMod = Math.max(modAtMin, modAtMax, 1);
  const range = maxMod - minMod || 0.1;
  const yStart = height - ((modAtMin - minMod) / range) * height;
  const yEnd = height - ((modAtMax - minMod) / range) * height;
  const yNeutral = height - ((1 - minMod) / range) * height;

  const isBonus = modAtMax > 1;

  return (
    <Tooltip
      title={`Q${qualityStart}–Q${qualityEnd}: ${modAtMin.toFixed(2)}→${modAtMax.toFixed(2)}`}
      placement="top"
    >
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        sx={{
          width,
          height,
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
        aria-label={`Modifier curve ${modAtMin} to ${modAtMax}`}
      >
        {/* Neutral line at 1.0 */}
        <line
          x1={0}
          y1={yNeutral}
          x2={width}
          y2={yNeutral}
          stroke="rgba(156,163,175,0.3)"
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        {/* Dead zone (flat at modAtMin) */}
        {qualityStart > 0 && (
          <line
            x1={0}
            y1={yStart}
            x2={x1}
            y2={yStart}
            stroke="rgba(107,114,128,0.5)"
            strokeWidth={1}
          />
        )}
        {/* Active interpolation line */}
        <line
          x1={x1}
          y1={yStart}
          x2={x2}
          y2={yEnd}
          stroke={isBonus ? '#34d399' : '#f87171'}
          strokeWidth={1.5}
        />
      </Box>
    </Tooltip>
  );
}
