import { NextResponse } from "next/server";
import manifest from "@/app/manifest";

function buildManifestResponse() {
  return NextResponse.json(manifest(), {
    headers: {
      "Content-Type": "application/manifest+json",
    },
  });
}

export function GET() {
  return buildManifestResponse();
}

export function HEAD() {
  return buildManifestResponse();
}
