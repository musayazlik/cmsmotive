import { authRoute } from "../_components/auth-page";

export const dynamic = "force-dynamic";

const route = authRoute("verify-email");

export const generateMetadata = route.generateMetadata;
export default route.Page;
