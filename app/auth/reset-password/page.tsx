import { authRoute } from "../_components/auth-page";

export const dynamic = "force-dynamic";

const route = authRoute("reset-password");

export const generateMetadata = route.generateMetadata;
export default route.Page;
