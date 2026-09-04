'use strict';
const emailOk = (email) => {
    if (!email) return false;
    return /^\S+@\S+\.\S+$/.test(email.trim());
};
const cleanPhone = (phone) => {
    if (!phone) return '';
    // Extract only digits and take the last 10 (removes country code like 91)
    return phone.replace(/\D/g, '').slice(-10);
};
const phoneOk = (phone) => {
    if (!phone) return false;
    return cleanPhone(phone).length === 10;
};
const normalizePhone = (rawPhone, countryCode = '+91') => {
    const cleaned = cleanPhone(rawPhone);
    if (!cleaned) return null;
    return `${countryCode} ${cleaned}`;
};
const passwordOk = (password) => {
    return typeof password === 'string' && password.length >= 6;
};
module.exports = {
    emailOk,
    phoneOk,
    cleanPhone,
    normalizePhone,
    passwordOk
};
