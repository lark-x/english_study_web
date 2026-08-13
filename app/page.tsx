"use client";
import dynamic from "next/dynamic";

const UnitStudyApp = dynamic(() => import("./study/unit-modules/UnitStudyApp"), { ssr: false });

export default function Page() {
  return <UnitStudyApp />;
}
