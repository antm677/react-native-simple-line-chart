/* eslint-disable react/no-array-index-key */
import React, {
    JSXElementConstructor,
    ReactElement,
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import {
    interpolate,
    SharedValue,
    useDerivedValue,
} from 'react-native-reanimated';
import { Platform, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, ClipPath, Marker, Circle } from 'react-native-svg';
import ActivePoint from './ActivePoint';
import EndPoint from './EndPoint';
import {
    createNewPath,
    getChartMinMaxValue,
    getIndexOfTheNearestXPoint,
    PathObject,
} from './utils';
import { DataPoint, ExtraConfig, Line } from './types';
import { ACTIVE_POINT_CONFIG, END_POINT } from './defaults';
import { AnimatedG, AnimatedPath } from './AnimatedComponents';
import useChartAnimation from './animations/animations';

const SvgPath = ({
    lines,
    svgHeight,
    svgWidth,
    activeTouchX,
    activeTouch,
    extraConfig,
    onPointChange,
    endSpacing,
    initialActivePoint,
    cornerRadius,
    markers,
    markerSize,
    markerColor
}: {
    lines: Line[];
    svgHeight: number;
    svgWidth: number;
    activeTouchX: SharedValue<number>;
    activeTouch: SharedValue<boolean>;
    extraConfig: ExtraConfig;
    endSpacing?: number;
    initialActivePoint?: number;
    cornerRadius?: number;
    markers?: boolean;
    markerSize?: number;
    markerColor?: string;
    onPointChange: (point?: DataPoint) => void;
}) => {
    const allData = lines.reduce((acc, line) => {
        if (line.data !== undefined) {
            // @ts-ignore
            return acc.concat(line?.data);
        }
        return acc;
    }, []);

    const axisMinMax = useMemo(() => {
        return getChartMinMaxValue({
            allData,
            alwaysStartYAxisFromZero: extraConfig.alwaysStartYAxisFromZero || false,
            calculateChartYAxisMinMax:
                extraConfig.calculateChartYAxisMinMax || undefined,
            calculateChartXAxisMinMax:
                extraConfig.calculateChartXAxisMinMax || undefined,
        });
    }, [allData]);

    const activeIndex = useDerivedValue(() => {
        // eslint-disable-next-line no-bitwise
        const activeTouchWithoutDecimals = ~~activeTouchX.value;

        if (activeTouchWithoutDecimals === 0 && initialActivePoint) {
            return initialActivePoint;
        }

        const data = lines[0]?.data || [];
        const dataLength = data.length;

        const minData = axisMinMax.minX;
        const maxData = axisMinMax.maxX;

        const denominator = svgWidth - (endSpacing || 20);
        const percentage = (activeTouchWithoutDecimals / denominator) * 100;

        const percentageToTimestampValue = interpolate(
            percentage,
            [0, 100],
            [minData, maxData]
        );

        let activeIndexLocal = getIndexOfTheNearestXPoint(
            data,
            percentageToTimestampValue
        );

        if (activeIndexLocal >= dataLength) {
            activeIndexLocal = dataLength - 1;
        }

        return activeIndexLocal;
    }, [activeTouchX, lines[0]?.data]);

    const newLines = [{ ...lines[0] }, { ...lines[0] }]
    newLines[1].fillColor = undefined
    newLines[0].lineColor = newLines[0].fillColor
    newLines[0].lineWidth = markerSize * 4

    return (
        <>
            {newLines
                .filter((line) => line?.data)
                .map((line, index) => {
                    if (line?.data) {
                        return (
                            <MemoizedLineComponent
                                key={`${index}`}
                                line={line}
                                allData={allData}
                                svgHeight={svgHeight}
                                svgWidth={svgWidth}
                                activeIndex={activeIndex}
                                activeTouch={activeTouch}
                                identifier={`${index}`}
                                extraConfig={extraConfig}
                                onPointChange={index === 0 ? onPointChange : undefined}
                                axisMinMax={axisMinMax}
                                cornerRadius={cornerRadius}
                                markers={markers}
                                markerSize={markerSize}
                                markerColor={markerColor}
                            />
                        );
                    }
                    // @ts-ignore
                    return <View key={`${index}`} />;
                })}
        </>
    );
};

const LineComponent = ({
    line,
    allData,
    svgHeight,
    svgWidth,
    activeTouch,
    activeIndex,
    identifier,
    extraConfig,
    onPointChange,
    axisMinMax,
    cornerRadius,
    markers,
    markerSize,
    markerColor
}: {
    line: Line;
    allData: DataPoint[];
    svgHeight: number;
    svgWidth: number;
    activeTouch: SharedValue<boolean>;
    activeIndex: SharedValue<number>;
    identifier: string;
    extraConfig: ExtraConfig;
    onPointChange?: (point?: DataPoint) => void;
    axisMinMax: ReturnType<typeof getChartMinMaxValue>;
    cornerRadius?: number;
    markers?: boolean;
    markerSize?: number;
    markerColor?: string;
}) => {
    const isLineColorGradient = Array.isArray(line.lineColor);
    const isFillColorGradient = Array.isArray(line.fillColor);
    const marker = {
        size: markers ? (markerSize !== undefined ? markerSize : 0) : 0,
        color: markers ? (markerColor !== undefined ? markerColor : "transparent") : "transparent"
    };

    const getActivePointColor = useCallback(() => {
        if (line.activePointConfig?.color) {
            return line.activePointConfig.color;
        }
        if (!isLineColorGradient) {
            return line.lineColor as string;
        }
        return ACTIVE_POINT_CONFIG.color;
    }, [line?.activePointConfig?.color, line?.lineColor, isLineColorGradient]);

    const localCreateNewPath = () => {
        return createNewPath({
            data: line?.data || [],
            endSpacing: extraConfig.endSpacing,
            svgHeight,
            svgWidth,
            isFilled: line.fillColor !== undefined,
            curve: line.curve,
            axisMinMax,
        });
    };

    const [isReadyToRenderBackground, setIsReadyToRenderBackground] =
        React.useState(Platform.OS === 'android');
    const [localPath, setLocalPath] = React.useState<PathObject>(
        localCreateNewPath()
    );

    const {
        startAnimation,
        lineWrapperAnimatedStyle,
        lineAnimatedProps,
        endPointAnimation,
    } = useChartAnimation({
        duration: extraConfig.animationConfig?.duration || 0,
        animationType: extraConfig.animationConfig?.animationType || 'fade',
        path: localPath,
    });

    useEffect(() => {
        const path = localCreateNewPath();

        if (extraConfig.animationConfig && startAnimation) {
            startAnimation({
                action: () => {
                    setLocalPath(path);
                },
            });
        } else {
            setLocalPath(path);
        }
    }, [
        line?.data.map((item) => item?.y).join(''),
        line.curve,
        line.key,
        allData,
    ]);

    const getBackgroundIdentifier = () => {
        return `${identifier}`;
    };

    const getStopPoints = useCallback(() => {
        const getColors = () => {
            if (isLineColorGradient) {
                return line.lineColor as string[];
            }
            return [line.lineColor as string, line.lineColor as string];
        };

        const colors = getColors();

        return colors.map((color, index) => {
            const offset = 100 - (index / (colors.length - 1)) * 100;

            const getStopOpacity = () => {
                if (line.trailingOpacity !== undefined && index === 0) {
                    return `${line.trailingOpacity}`;
                }
                return '1';
            };

            return (
                <Stop
                    key={`${index}`}
                    offset={`${offset}%`}
                    stopColor={color}
                    stopOpacity={getStopOpacity()}
                />
            );
        });
    }, [line.lineColor, line.trailingOpacity]);

    const getFillStopPoints = useCallback(() => {
        const getColors = () => {
            if (isFillColorGradient) {
                return line.fillColor as string[];
            }
            return [line.fillColor as string, line.fillColor as string];
        };

        const colors = getColors();
        return [(
            <Stop
                key={0}
                offset={`50%`}
                stopColor={colors[0]}
                stopOpacity={1}
            />
        ), (
            <Stop
                key={1}
                offset={`100%`}
                stopColor={colors[1]}
                stopOpacity={1}
            />
        )]
    }, [line.fillColor]);

    return (
        <>
            {isReadyToRenderBackground && (
                <Defs>
                    <LinearGradient
                        id={getBackgroundIdentifier()}
                        gradientUnits="userSpaceOnUse"
                        x1="120"
                        y1="0"
                        x2="0"
                        y2="0"
                    >
                        {
                            getStopPoints() as ReactElement<
                                any,
                                string | JSXElementConstructor<any>
                            >[]
                        }
                    </LinearGradient>
                    <LinearGradient
                        id="fillGradient"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="120"
                        x2="0"
                        y2="0"
                    >
                        {
                            getFillStopPoints() as ReactElement<
                                any,
                                string | JSXElementConstructor<any>
                            >[]
                        }
                    </LinearGradient>
                    <ClipPath id="round-corner">
                        <Rect x="0" y="0" width={svgWidth} height={svgHeight} rx={cornerRadius} ry={cornerRadius} />
                    </ClipPath>
                    <Marker id="point" markerWidth="5" markerHeight="5" refX="5" refY="5" orient="auto" markerUnits="strokeWidth">
                        <Circle cx="5" cy="5" r={marker.size} fill={marker.color} />
                    </Marker>
                </Defs>
            )}
            <AnimatedG
                // @ts-ignore
                style={lineWrapperAnimatedStyle ? { ...lineWrapperAnimatedStyle } : undefined}
                clipPath={`url(#round-corner)`}
            >
                <AnimatedPath
                    onLayout={(e) => {
                        // this is a hack to fix the ios flashes white on mount
                        if (
                            Number.isFinite(e.nativeEvent.layout.width) &&
                            Platform.OS === 'ios'
                        ) {
                            setTimeout(() => {
                                setIsReadyToRenderBackground(true);
                            }, 20);
                        }
                    }}
                    strokeLinecap="round"
                    stroke={`url(#${getBackgroundIdentifier()})`}
                    strokeWidth={line.lineWidth || 2}
                    markerStart={markers && !(line.lineColor == line.fillColor) ? "url(#point)" : ""}
                    markerMid={markers && !(line.lineColor == line.fillColor) ? "url(#point)" : ""}
                    markerEnd={markers && !(line.lineColor == line.fillColor) ? "url(#point)" : ""}
                    fill={line.fillColor !== undefined ? (isFillColorGradient ? `url(#fillGradient)` : line.fillColor.toString()) : 'transparent'}
                    fillOpacity={1}
                    animatedProps={lineAnimatedProps}
                />

                {line.endPointConfig && endPointAnimation && (
                    <EndPoint
                        x={localPath?.x(localPath?.data[localPath.data.length - 1]?.x || 0)}
                        y={localPath?.y(localPath?.data[localPath.data.length - 1]?.y || 0)}
                        color={line.endPointConfig?.color || END_POINT.color}
                        animated={line.endPointConfig?.animated || END_POINT.animated}
                        radius={line.endPointConfig?.radius || END_POINT.radius}
                        endPointAnimation={endPointAnimation}
                    />
                )}
            </AnimatedG >

            {line !== undefined && line.activePointConfig !== undefined && (
                <ActivePoint
                    data={localPath?.data || []}
                    activeTouch={activeTouch}
                    width={svgWidth}
                    height={svgHeight}
                    activePointComponent={
                        Array.isArray(line.fillColor) ?
                            line.activePointComponent :
                            (line.fillColor != line.lineColor ? line.activePointComponent : undefined)
                    }
                    activePointComponentWithSharedValue={
                        line.activePointComponentWithSharedValue
                    }
                    activeIndex={activeIndex}
                    path={localPath}
                    onPointChange={onPointChange}
                    color={getActivePointColor()}
                    borderColor={
                        line?.activePointConfig?.borderColor ||
                        ACTIVE_POINT_CONFIG.borderColor
                    }
                    borderWidth={
                        line?.activePointConfig?.borderWidth !== undefined &&
                            line?.activePointConfig?.borderWidth >= 0
                            ? line?.activePointConfig?.borderWidth
                            : ACTIVE_POINT_CONFIG.borderWidth
                    }
                    showVerticalLine={
                        line?.activePointConfig?.showVerticalLine !== undefined
                            ? line?.activePointConfig?.showVerticalLine
                            : ACTIVE_POINT_CONFIG.showVerticalLine
                    }
                    showActivePointCircle={
                        line?.activePointConfig?.showActivePointCircle !== undefined
                            ? line?.activePointConfig?.showActivePointCircle
                            : ACTIVE_POINT_CONFIG.showActivePointCircle
                    }
                    verticalLineColor={
                        line?.activePointConfig?.verticalLineColor ||
                        ACTIVE_POINT_CONFIG.verticalLineColor
                    }
                    verticalLineWidth={
                        line?.activePointConfig?.verticalLineWidth ||
                        ACTIVE_POINT_CONFIG.verticalLineWidth
                    }
                    verticalLineDashArray={
                        line?.activePointConfig?.verticalLineDashArray ||
                        ACTIVE_POINT_CONFIG.verticalLineDashArray
                    }
                    verticalLineOpacity={
                        line?.activePointConfig?.verticalLineOpacity ||
                        ACTIVE_POINT_CONFIG.verticalLineOpacity
                    }
                    radius={line?.activePointConfig?.radius || ACTIVE_POINT_CONFIG.radius}
                />
            )
            }
        </>
    );
};

const MemoizedLineComponent = React.memo(LineComponent, (prev, next) => {
    return (
        prev.line.data.length === next.line.data.length &&
        prev.line.curve === next.line.curve &&
        prev.line.lineColor === next.line.lineColor &&
        prev.line.key === next.line.key &&
        prev.allData.map((item) => item.y).join('') ===
        next.allData.map((item) => item.y).join('')
    );
});

export default SvgPath;
