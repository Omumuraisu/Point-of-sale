import { useRouter } from "expo-router";
import AddProductScreen from "../components/pos/addProduct";

interface AddProductPayload {
    name: string;
    category: string;
}

const AddProductRoute = () => {
    const router = useRouter();

    const handleSave = (payload: AddProductPayload) => {
        console.log("Save product payload:", payload);
        router.back();
    };

    return (
        <AddProductScreen onCancel={() => router.back()} onSave={handleSave} />
    );
};

export default AddProductRoute;
