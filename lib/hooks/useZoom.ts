import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface ZoomOptions {
    minScale?: number;
    maxScale?: number;
    initialScale?: number;
    onZoom?: (transform: d3.ZoomTransform) => void;
    onZoomEnd?: (transform: d3.ZoomTransform) => void;
}

export function useZoom<SVGType extends SVGSVGElement>({
    minScale = 0.5,
    maxScale = 8,
    initialScale = 1,
    onZoom,
    onZoomEnd,
}: ZoomOptions = {}) {
    const svgRef = useRef<SVGType>(null);
    const gRef = useRef<SVGGElement>(null);
    const onZoomRef = useRef<ZoomOptions["onZoom"]>(onZoom);
    const onZoomEndRef = useRef<ZoomOptions["onZoomEnd"]>(onZoomEnd);

    useEffect(() => {
        onZoomRef.current = onZoom;
        onZoomEndRef.current = onZoomEnd;
    }, [onZoom, onZoomEnd]);

    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;

        const zoom = d3
            .zoom<SVGType, unknown>()
            .scaleExtent([minScale, maxScale])
            .on("zoom", (event) => {
                d3.select(gRef.current).attr("transform", event.transform);
                onZoomRef.current?.(event.transform);
            });

        zoom.on("end", (event) => {
            onZoomEndRef.current?.(event.transform);
        });

        const svgSelection = d3.select(svgRef.current);
        svgSelection.call(zoom);

        // Set initial zoom
        svgSelection.call(
            zoom.transform,
            d3.zoomIdentity.translate(0, 0).scale(initialScale)
        );
        onZoomRef.current?.(d3.zoomIdentity.translate(0, 0).scale(initialScale));

        return () => {
            svgSelection.on(".zoom", null);
        };
    }, [minScale, maxScale, initialScale]);

    return { svgRef, gRef };
}
