import { useRouter } from "expo-router";
import AddProductScreen from "../components/pos/addProduct";

const AddProductRoute = () => {
    const router = useRouter();

    const handleSave = (payload) => {
        console.log("Save product payload:", payload);
        router.back();
    };

    return (
        <AddProductScreen onCancel={() => router.back()} onSave={handleSave} />
    );
};

export default AddProductRoute;
