import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface ZoomOptions {
    minScale?: number;
    maxScale?: number;
    initialScale?: number;
    /** Extra dependency to re-trigger zoom setup (e.g. set to true once the SVG is mounted). */
    ready?: unknown;
    onZoom?: (transform: d3.ZoomTransform) => void;
    onZoomEnd?: (transform: d3.ZoomTransform) => void;
}

export function useZoom<SVGType extends SVGSVGElement>({
    minScale = 0.5,
    maxScale = 8,
    initialScale = 1,
    ready,
    onZoom,
    onZoomEnd,
}: ZoomOptions = {}) {
    const svgRef = useRef<SVGType>(null);
    const gRef = useRef<SVGGElement>(null);
    const onZoomRef = useRef<ZoomOptions["onZoom"]>(onZoom);
    const onZoomEndRef = useRef<ZoomOptions["onZoomEnd"]>(onZoomEnd);
    const zoomInstanceRef = useRef<d3.ZoomBehavior<SVGType, unknown> | null>(null);

    useEffect(() => {
        onZoomRef.current = onZoom;
        onZoomEndRef.current = onZoomEnd;
    }, [onZoom, onZoomEnd]);

    useEffect(() => {
        if (!svgRef.current || !gRef.current) return;

        // Prevent browser from intercepting touch gestures (pinch-to-zoom)
        svgRef.current.style.touchAction = "none";

        const zoom = d3
            .zoom<SVGType, unknown>()
            .scaleExtent([minScale, maxScale])
            .on("zoom", (event) => {
                d3.select(gRef.current).attr("transform", event.transform);
                onZoomRef.current?.(event.transform);
            });

        zoomInstanceRef.current = zoom;

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
    }, [minScale, maxScale, initialScale, ready]);

    const resetZoom = () => {
        if (svgRef.current && zoomInstanceRef.current) {
            d3.select(svgRef.current)
                .transition()
                .duration(750)
                .call(zoomInstanceRef.current.transform, d3.zoomIdentity.translate(0, 0).scale(initialScale));
            onZoomRef.current?.(d3.zoomIdentity.translate(0, 0).scale(initialScale));
        }
    };

    const zoomBy = (factor: number) => {
        if (svgRef.current && zoomInstanceRef.current) {
            d3.select(svgRef.current)
                .transition()
                .duration(200)
                .call(zoomInstanceRef.current.scaleBy, factor);
        }
    };

    return { svgRef, gRef, resetZoom, zoomBy };
}
