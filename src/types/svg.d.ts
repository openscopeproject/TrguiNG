declare module "*.svg" {
    import type React from "react";

    const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

    export default ReactComponent;
}
