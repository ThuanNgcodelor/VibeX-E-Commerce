import React, { useEffect } from "react";
import Header from "../../components/client/Header";
import Footer from "../../components/client/Footer";
import FlashSale from "../../components/client/FlashSale";

const FlashSalePage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="flash-sale-page" style={{ backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
            <Header />
            <div className="container" style={{ paddingBottom: "20px" }}>
                {/* Pass isPage={true} to handle empty state and layout adjustments */}
                <FlashSale isPage={true} />
            </div>
            <Footer />
        </div>
    );
};

export default FlashSalePage;
