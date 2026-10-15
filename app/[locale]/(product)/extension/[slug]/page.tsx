import { productRoute } from "../../_components/product-route";

export const dynamic = "force-dynamic";

const route = productRoute("extension");

export const generateMetadata = route.generateMetadata;
export default route.Page;
