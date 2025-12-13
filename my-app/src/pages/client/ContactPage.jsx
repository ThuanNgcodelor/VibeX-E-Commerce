import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Header from "../../components/client/Header";
import Footer from "../../components/client/Footer";
import emailjs from '@emailjs/browser';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';


export default function ContactPage() {
    const { t } = useTranslation();
    const form = useRef();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        message: "",
    });
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const sendEmail = (e) => {
        e.preventDefault();
        setSending(true);
        setError(null);

        // Simple form validation
        if (!formData.name || !formData.email || !formData.message) {
            setError(t('contact.fillAllFields'));
            setSending(false);
            return;
        }

        emailjs.sendForm('service_1fgszbk', 'template_dddhepd', form.current, 'hwJeacFMwiXDUxplu')
            .then((result) => {
                console.log("Message sent successfully", result.text);
                setSuccessMessage(t('contact.success'));
                setSending(false);
                setFormData({ name: "", email: "", message: "" });
            }, (error) => {
                console.log("Error sending message", error.text);
                setError(t('contact.error'));
                setSending(false);
            });
    };
    const containerStyle = {
        width: '100%',
        height: '300px',
    };

    const center = {
        lat: 10.030384,
        lng: 105.717647
    };
    return (
        <div className="wrapper">
            <Header />
            <main className="main-content">
                <div className="container py-5">
                    <h3 className="mb-4">{t('contact.title')}</h3>

                    {error && <div className="alert alert-danger">{error}</div>}
                    {successMessage && <div className="alert alert-success">{successMessage}</div>}

                    <div className="row">
                        <div className="col-md-6">
                            <form ref={form} onSubmit={sendEmail}>
                                <div className="mb-3">
                                    <label htmlFor="name" className="form-label">{t('contact.nameLabel')}</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="email" className="form-label">{t('contact.emailLabel')}</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="message" className="form-label">{t('contact.messageLabel')}</label>
                                    <textarea
                                        className="form-control"
                                        id="message"
                                        name="message"
                                        rows="5"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                    ></textarea>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={sending}>
                                    {sending ? t('contact.sending') : t('contact.sendButton')}
                                </button>
                            </form>
                        </div>

                        <div className="col-md-6">
                            <h4>{t('contact.contactInfo')}</h4>
                            <p>
                                <strong>{t('contact.address')}:</strong> Ninh Kieu, Can Tho, Vietnam
                            </p>
                            <p>
                                <strong>{t('contact.phone')}:</strong> (+012) 3456 7890
                            </p>
                            <p>
                                <strong>{t('contact.email')}:</strong> info@example.com
                            </p>

                            {/* Google Map Embed */}
                            <div className="mb-4">
                                <h5>{t('contact.location')}</h5>
                                <LoadScript googleMapsApiKey="AIzaSyBN_rkyxM1uIXvFEXfRvAMVq3nxRtqO4eo">
                                    <GoogleMap
                                        mapContainerStyle={containerStyle}
                                        center={center}
                                        zoom={15}
                                    >
                                        <Marker position={center} />
                                    </GoogleMap>
                                </LoadScript>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
