import React, { useEffect } from 'react';
import {
    Gesture,
    GestureDetector,
    PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { AnimatedView } from './AnimatedComponents';
import { EXTRA_CONFIG, LINE_CHART } from './defaults';
import SvgPath from './SvgPath';
import { DataPoint, ExtraConfig, LineChart as LineChartProps } from './types';

const getExtraConfig = (extraConfig: ExtraConfig): ExtraConfig => {
    return {
        alwaysShowActivePoint:
            extraConfig.alwaysShowActivePoint !== undefined
                ? extraConfig.alwaysShowActivePoint
                : EXTRA_CONFIG.alwaysShowActivePoint,
        hideActivePointOnBlur:
            extraConfig.hideActivePointOnBlur !== undefined
                ? extraConfig.hideActivePointOnBlur
                : EXTRA_CONFIG.hideActivePointOnBlur,
        alwaysStartYAxisFromZero:
            extraConfig.alwaysStartYAxisFromZero !== undefined
                ? extraConfig.alwaysStartYAxisFromZero
                : EXTRA_CONFIG.alwaysStartYAxisFromZero,
        initialActivePoint:
            extraConfig.initialActivePoint !== undefined
                ? extraConfig.initialActivePoint
                : EXTRA_CONFIG.initialActivePoint,
        simultaneousHandlers:
            extraConfig.simultaneousHandlers !== undefined
                ? extraConfig.simultaneousHandlers
                : EXTRA_CONFIG.simultaneousHandlers,
        endSpacing:
            extraConfig.endSpacing !== undefined
                ? extraConfig.endSpacing
                : EXTRA_CONFIG.endSpacing,
        calculateChartYAxisMinMax:
            extraConfig.calculateChartYAxisMinMax ||
            EXTRA_CONFIG.calculateChartYAxisMinMax,
        calculateChartXAxisMinMax:
            extraConfig.calculateChartXAxisMinMax ||
            EXTRA_CONFIG.calculateChartXAxisMinMax,
        activeOffsetX: extraConfig.activeOffsetX || EXTRA_CONFIG.activeOffsetX,
        animationConfig:
            extraConfig.animationConfig || EXTRA_CONFIG.animationConfig,
    };
};
function LineChart({
    height = LINE_CHART.height,
    width = LINE_CHART.width,
    extraConfig,
    backgroundColor = LINE_CHART.backgroundColor,
    onPointFocus = LINE_CHART.onPointFocus,
    onPointLoseFocus = LINE_CHART.onPointLoseFocus,
    activePointSharedValue,
    cornerRadius = LINE_CHART.cornerRadius,
    markers = LINE_CHART.markers,
    markerSize = LINE_CHART.markerSize,
    markerColor = LINE_CHART.markerColor,
    lines = [],
}: LineChartProps) {
    const svgHeight = height;
    const svgWidth = width;
    const radius = cornerRadius;
    const activeTouchX = useSharedValue(0);
    const activeTouch = useSharedValue(false);
    const [isSimultaneousHandlersEnabled, setIsSimultaneousHandlersEnabled] =
        React.useState(true);
    extraConfig = getExtraConfig(extraConfig || {});
    const { alwaysShowActivePoint, hideActivePointOnBlur } = extraConfig;

    const onPointChange = (point?: DataPoint) => {
        if (point) {
            if (onPointFocus) {
                runOnJS(onPointFocus)(point);
            }
            if (activePointSharedValue) {
                activePointSharedValue.value = point;
            }
        }
    };

    const onPointLoseFocusLocal = () => {
        if (onPointLoseFocus) {
            onPointLoseFocus();
        }
        if (activePointSharedValue && !extraConfig?.alwaysShowActivePoint) {
            setTimeout(() => {
                activePointSharedValue.value = undefined;
            }, 10);
        }
    };

    useEffect(() => {
        if (extraConfig?.initialActivePoint) {
            activeTouch.value = true;
            if (onPointFocus) {
                const point = lines[0]?.data
                    ? lines[0]?.data[extraConfig?.initialActivePoint as number]
                    : undefined;
                if (point) {
                    onPointFocus(point);
                }
            }
        } else {
            onPointLoseFocusLocal();
        }
    }, [lines[0]?.data]);

    const onPanUpdate = (e: PanGestureHandlerEventPayload) => {
        'worklet';

        if (isSimultaneousHandlersEnabled === true) {
            runOnJS(setIsSimultaneousHandlersEnabled)(false);
        }
        activeTouch.value = true;
        activeTouchX.value = e.x;
    };

    const onPanEnd = () => {
        'worklet';

        runOnJS(setIsSimultaneousHandlersEnabled)(true);
        if (alwaysShowActivePoint === false || hideActivePointOnBlur === true) {
            activeTouch.value = false;
        }
        runOnJS(onPointLoseFocusLocal)();
    };

    const panGesture =
        extraConfig.simultaneousHandlers && isSimultaneousHandlersEnabled
            ? Gesture.Pan()
                .simultaneousWithExternalGesture(extraConfig.simultaneousHandlers)
                .activeOffsetX(
                    extraConfig?.activeOffsetX || EXTRA_CONFIG.activeOffsetX
                )
                .onBegin(onPanUpdate)
                .onUpdate(onPanUpdate)
                .onFinalize(onPanEnd)
            : Gesture.Pan()
                .activeOffsetX(
                    extraConfig?.activeOffsetX || EXTRA_CONFIG.activeOffsetX
                )
                .onBegin(onPanUpdate)
                .onUpdate(onPanUpdate)
                .onFinalize(onPanEnd);

    return (
        <GestureDetector gesture={panGesture}>
            <AnimatedView style={{ backgroundColor: backgroundColor, borderRadius: radius }}>
                <Svg width={svgWidth} height={svgHeight}>
                    <SvgPath
                        lines={lines}
                        svgHeight={svgHeight}
                        svgWidth={svgWidth}
                        cornerRadius={radius}
                        activeTouch={activeTouch}
                        activeTouchX={activeTouchX}
                        extraConfig={extraConfig}
                        initialActivePoint={extraConfig?.initialActivePoint}
                        endSpacing={extraConfig?.endSpacing}
                        onPointChange={onPointChange}
                        markers={markers}
                        markerSize={markerSize}
                        markerColor={markerColor}
                    />
                </Svg>
            </AnimatedView>
        </GestureDetector>
    );
}

/** @ignore */
export const MemoizedLineChart = React.memo(
    LineChart,
    (previousProps, nextProps) => {
        if (
            JSON.stringify(previousProps.lines[0]) !==
            JSON.stringify(nextProps.lines[0])
        ) {
            return false;
        }

        if (
            JSON.stringify(previousProps.lines[1]?.data) !==
            JSON.stringify(nextProps.lines[1]?.data)
        ) {
            return false;
        }

        if (
            JSON.stringify(previousProps.backgroundColor) !==
            JSON.stringify(nextProps.backgroundColor)
        ) {
            return false;
        }

        return true;
    }
);

export default MemoizedLineChart;
