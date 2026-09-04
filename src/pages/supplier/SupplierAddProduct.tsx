import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../utils/authStore';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';
interface Category {
  id: string;
  name: string;
}
interface Variant {
  id: string;
  name: string;
  capacity: string;
  temperature: string;
  packaging: string;
  sellingPrice: string;
  stock: string;
  subscription: {
    available: boolean;
    frequencies: string[];
    price: string;
  };
  deposit: {
    required: boolean;
    amount: string;
  };
}
const SupplierAddProduct: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuthStore();
  const productId = (location.state as { productId?: string })?.productId;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<'active' | 'draft'>('draft');
  const [variants, setVariants] = useState<Variant[]>([]);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/categories`);
        const data = await res.json();
        if (data.success) {
          setCategories(data.data);
          if (data.data.length > 0 && !productId) {
            setCategoryId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch categories');
      }
    };
    const fetchProduct = async () => {
      if (!productId || !token) return;
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          const p = data.data;
          setName(p.name || '');
          setBrand(p.brand || '');
          setCategoryId(p.categoryId || '');
          setDescription(p.description || '');
          setImages(p.images || []);
          setStatus(p.status || 'draft');
          setVariants(p.variants || []);
        }
      } catch (err) {
        console.error('Failed to fetch product');
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
    fetchProduct();
  }, [productId, token]);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError('Cloudinary credentials are missing.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    try {
      setBusy(true);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        setImages(prev => [...prev, data.secure_url]);
      } else {
        setError('Image upload failed.');
      }
    } catch (err) {
      setError('Image upload failed.');
    } finally {
      setBusy(false);
    }
  };
  const addVariant = () => {
    setVariants(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        name: '',
        capacity: '',
        temperature: '',
        packaging: '',
        sellingPrice: '',
        stock: '',
        subscription: { available: false, frequencies: [], price: '' },
        deposit: { required: false, amount: '' }
      }
    ]);
  };
  const updateVariant = (id: string, key: string, value: any) => {
    setVariants(prev =>
      prev.map(v => (v.id === id ? { ...v, [key]: value } : v))
    );
  };
  const handleSubmit = async () => {
    if (!name || !categoryId) {
      setError('Product name and category are required.');
      return;
    }
    if (variants.length === 0) {
      setError('At least one variant is required.');
      return;
    }
    setBusy(true);
    setError('');
    const payload = {
      name,
      brand,
      categoryId,
      description,
      images,
      status,
      variants
    };
    try {
      const url = productId ? `${API_URL}/products/${productId}` : `${API_URL}/products`;
      const method = productId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        navigate('/supplier/products', { state: { created: name, updated: productId ? true : false } });
      } else {
        setError(data.message || 'Failed to save product');
      }
    } catch (err) {
      setError('Failed to save product');
    } finally {
      setBusy(false);
    }
  };
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">{productId ? 'Edit Product' : 'Add Product'}</h1>
        <button onClick={() => navigate('/supplier/products')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Basic Info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Product Name *</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AquaBlue 20L" />
          </div>
          <div>
            <label className={labelCls}>Brand</label>
            <input className={inputCls} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. WaterMarket" />
          </div>
          <div>
            <label className={labelCls}>Category *</label>
            <select className={inputCls} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as 'active' | 'draft')}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Product description..." />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Media</h2>
        <div className="flex flex-wrap gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="relative h-24 w-24 rounded-xl border border-slate-200 overflow-hidden">
              <img src={img} alt={`Product ${idx}`} className="h-full w-full object-cover" />
              <button
                onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-rose-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs"
              >✕</button>
            </div>
          ))}
          <label className={`flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:text-blue-700 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            <span className="text-xs font-bold text-center">Upload<br/>Image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Variants</h2>
          <button onClick={addVariant} className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100">
            + Add Variant
          </button>
        </div>
        <div className="space-y-4">
          {variants.map((v, idx) => (
            <div key={v.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Variant {idx + 1}</h3>
                <button
                  onClick={() => setVariants(prev => prev.filter(x => x.id !== v.id))}
                  className="text-rose-500 text-xs font-bold hover:underline"
                >Remove</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input className={inputCls} value={v.name} onChange={e => updateVariant(v.id, 'name', e.target.value)} placeholder="e.g. 20L Bottle" />
                </div>
                <div>
                  <label className={labelCls}>Capacity</label>
                  <input className={inputCls} value={v.capacity} onChange={e => updateVariant(v.id, 'capacity', e.target.value)} placeholder="e.g. 20 Liters" />
                </div>
                <div>
                  <label className={labelCls}>Temperature</label>
                  <input className={inputCls} value={v.temperature} onChange={e => updateVariant(v.id, 'temperature', e.target.value)} placeholder="e.g. Normal" />
                </div>
                <div>
                  <label className={labelCls}>Packaging</label>
                  <input className={inputCls} value={v.packaging} onChange={e => updateVariant(v.id, 'packaging', e.target.value)} placeholder="e.g. PET Bottle" />
                </div>
                <div>
                  <label className={labelCls}>Price (₹) *</label>
                  <input type="number" className={inputCls} value={v.sellingPrice} onChange={e => updateVariant(v.id, 'sellingPrice', e.target.value)} placeholder="e.g. 50" />
                </div>
                <div>
                  <label className={labelCls}>Stock *</label>
                  <input type="number" className={inputCls} value={v.stock} onChange={e => updateVariant(v.id, 'stock', e.target.value)} placeholder="e.g. 100" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100 mt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={v.subscription.available}
                    onChange={e => updateVariant(v.id, 'subscription', { ...v.subscription, available: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-600">Subscription Available</span>
                </div>
                {v.subscription.available && (
                  <div className="grid grid-cols-2 gap-3 sm:col-span-1">
                    <input className={inputCls} value={v.subscription.frequencies.join(', ')} onChange={e => updateVariant(v.id, 'subscription', { ...v.subscription, frequencies: e.target.value.split(',').map(s => s.trim()) })} placeholder="Frequencies (e.g. Daily, Weekly)" />
                    <input className={inputCls} value={v.subscription.price} onChange={e => updateVariant(v.id, 'subscription', { ...v.subscription, price: e.target.value })} placeholder="Sub Price" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={v.deposit.required}
                    onChange={e => updateVariant(v.id, 'deposit', { ...v.deposit, required: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-600">Deposit Required</span>
                </div>
                {v.deposit.required && (
                  <div className="sm:col-span-1">
                    <input className={inputCls} value={v.deposit.amount} onChange={e => updateVariant(v.id, 'deposit', { ...v.deposit, amount: e.target.value })} placeholder="Deposit Amount" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {variants.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-4">No variants added yet. Click "Add Variant" to create one.</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/supplier/products')} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-sky-600 disabled:opacity-50"
        >
          {busy ? 'Saving...' : (productId ? 'Update Product' : 'Publish Product')}
        </button>
      </div>
    </div>
  );
};
export default SupplierAddProduct;
