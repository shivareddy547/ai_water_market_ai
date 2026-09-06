import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Listing,
  applyFilters,
  buildFacets,
  buildListings,
  countActiveFilters,
  emptyFilters,
  loadCart,
  ProductFilters,
  saveCart,
} from '../../utils/marketplace';
import { api } from '../../utils/api';
import { useAuthStore } from '../../utils/authStore';
import CustomerProductsPageHeader, {
  CategoryChip,
} from '../../components/customer/CustomerProductsPageHeader';
import CustomerProductsPageTestimonials from '../../components/customer/CustomerProductsPageTestimonials';
import FilterSheet from '../../components/customer/FilterSheet';
import ProductCard from '../../components/customer/ProductCard';
import ProductDetailModal from '../../components/customer/ProductDetailModal';
import CartBar from '../../components/customer/CartBar';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const inr = (n: number): string => `₹${Number(n || 0).toLocaleString('en-IN')}`;
// Wishlist helpers
const loadWishlist = (): string[] => {
  try {
    const raw = localStorage.getItem('wishlist');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveWishlist = (keys: string[]) => {
  localStorage.setItem('wishlist', JSON.stringify(keys));
  window.dispatchEvent(new Event('wishlist-updated'));
};
// -------- IP-based pincode fallback --------
const fetchPincodeFromIP = async (): Promise<string | null> => {
  try {
    const resp = await fetch('https://ipapi.co/json/');
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.postal) return data.postal;
    }
    const resp2 = await fetch('https://ipinfo.io/json');
    if (resp2.ok) {
      const data2 = await resp2.json();
      if (data2 && data2.postal) return data2.postal;
    }
    return null;
  } catch {
    return null;
  }
};
// -------- Location details and autocomplete ----------
interface LocationDetails {
  city: string;
  country: string;
  formatted: string;
}
interface Suggestion {
  place_id: number;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}
const loadLocationDetails = (): LocationDetails | null => {
  try {
    const raw = localStorage.getItem('customer_location_details');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const CustomerProducts: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filters, setFilters] = useState<ProductFilters>(() => emptyFilters());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const { token, user } = useAuthStore();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [wishlistKeys, setWishlistKeys] = useState<string[]>(() => loadWishlist());
  const [showWishlistOnly, setShowWishlistOnly] = useState(false);
  const [customerPincode, setCustomerPincode] = useState<string>(() => localStorage.getItem('customer_pincode') || '');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(() => loadLocationDetails());
  // Location modal state
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [modalPincode, setModalPincode] = useState('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pincodeInputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const handlePincodeChange = (val: string, details?: LocationDetails | null) => {
    setCustomerPincode(val);
    localStorage.setItem('customer_pincode', val);
    if (details) {
      setLocationDetails(details);
      localStorage.setItem('customer_location_details', JSON.stringify(details));
    } else {
      setLocationDetails(null);
      localStorage.removeItem('customer_location_details');
    }
    setLocationError(null);
    setLocationModalOpen(false);
  };
  const handleClearLocation = () => {
    setCustomerPincode('');
    setLocationDetails(null);
    localStorage.removeItem('customer_pincode');
    localStorage.removeItem('customer_location_details');
    setModalPincode('');
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setLocationError(null);
  };
  // Autocomplete search
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=in`
      );
      if (!resp.ok) throw new Error('Search failed');
      const data = await resp.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };
  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const addr = suggestion.address;
    const pincode = addr.postcode || '';
    const city = addr.city || addr.town || addr.village || '';
    const country = addr.country || '';
    const formatted = suggestion.display_name;
    const details: LocationDetails = { city, country, formatted };
    if (pincode) {
      handlePincodeChange(pincode, details);
    } else {
      setLocationDetails(details);
      localStorage.setItem('customer_location_details', JSON.stringify(details));
      setLocationError(null);
      setLocationModalOpen(false);
    }
    setSearchQuery(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
  };
  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  // Sync modal state when opening
  useEffect(() => {
    if (locationModalOpen) {
      setModalPincode(customerPincode);
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
      setLocationError(null);
      setTimeout(() => {
        if (!customerPincode && pincodeInputRef.current) {
          pincodeInputRef.current.focus();
        } else if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [locationModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Update location details when reverse geocoding succeeds
  const updateLocationFromCoords = async (lat: number, lon: number) => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`
      );
      if (!resp.ok) throw new Error('Nominatim reverse failed');
      const data = await resp.json();
      if (data && data.address) {
        const addr = data.address;
        const pincode = addr.postcode || '';
        const city = addr.city || addr.town || addr.village || '';
        const country = addr.country || '';
        const formatted = data.display_name || '';
        const details: LocationDetails = { city, country, formatted };
        if (pincode) {
          handlePincodeChange(pincode, details);
        } else {
          setLocationDetails(details);
          localStorage.setItem('customer_location_details', JSON.stringify(details));
          setLocationError(null);
          setLocationModalOpen(false);
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setLocationError('Failed to get address details from location.');
    }
  };
  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    if (window.isSecureContext === false) {
      setLocationError('Geolocation requires a secure context (HTTPS). If running locally, use "localhost" instead of an IP address.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await updateLocationFromCoords(latitude, longitude);
        setLocating(false);
      },
      async (error) => {
        console.error("Geolocation error:", error);
        try {
          const ipPincode = await fetchPincodeFromIP();
          if (ipPincode) {
            handlePincodeChange(ipPincode);
            setLocating(false);
            return;
          }
        } catch (ipError) {
          console.error("IP fallback failed:", ipError);
        }
        let message = "Unable to retrieve your location. ";
        if (error.code === 1) {
          message += "Permission denied. Please allow location access in your browser settings, or enter your pincode manually below.";
        } else if (error.code === 2) {
          message += "Location unavailable. Please check your network or GPS, or enter your pincode manually.";
        } else if (error.code === 3) {
          message += "Timeout. It took too long to get your location. Please enter your pincode manually.";
        } else {
          message += "Please enter your pincode manually below.";
        }
        setLocationError(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };
  const handleApplyPincode = () => {
    const pin = modalPincode.trim();
    if (pin.length === 6) {
      handlePincodeChange(pin);
    } else if (pin.length > 0) {
      setLocationError('Please enter a valid 6-digit PIN code.');
    }
  };
  const handlePincodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyPincode();
    }
  };
  // Fetch Cart from API or LocalStorage
  useEffect(() => {
    if (token) {
      api.get('/cart').then(res => {
        setCart(res.data || {});
      }).catch(() => {}).finally(() => setCartLoaded(true));
    } else {
      setCart(loadCart());
      setCartLoaded(true);
    }
  }, [token]);
  // Fetch Products and Categories from API
  useEffect(() => {
    const fetchProductsAndCategories = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch(`${API_URL}/products/public`),
          fetch(`${API_URL}/categories`),
        ]);
        const prodData = await prodRes.json();
        const catData = await catRes.json();
        if (prodData.success) {
          const allProducts = prodData.data;
          const builtListings = buildListings(allProducts);
          const enriched = builtListings.map(l => {
            const product = allProducts.find((p: any) => p.id === l.productId);
            const warehouseIds = product?.warehouseIds || [];
            const supplierId = product?.userId || product?.user_id;
            const u = product?.user;
            const supplierName =
              u?.storeName ||
              u?.store_name ||
              [u?.firstName || u?.first_name, u?.lastName || u?.last_name]
                .filter(Boolean)
                .join(' ') ||
              (supplierId ? `Supplier #${supplierId.slice(-6).toUpperCase()}` : l.supplier);
            const supplierWarehouses = u?.warehouseAddresses || u?.warehouse_addresses || [];
            return { ...l, warehouseIds, supplierId, supplier: supplierName, supplierWarehouses };
          });
          setListings(enriched);
        }
        if (catData.success) {
          setCategories(catData.data);
        }
      } catch (err) {
        console.error('Failed to fetch data');
      }
    };
    fetchProductsAndCategories();
  }, []);
  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener('open-cart', openCart);
    return () => window.removeEventListener('open-cart', openCart);
  }, []);
  useEffect(() => {
    if (location.state?.openCart) {
      setCartOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const catId = params.get('category');
    const wishlist = params.get('wishlist') === 'true';
    setShowWishlistOnly(wishlist);
    if (catId) {
      setFilters(prev => {
        if (prev.categories.length === 1 && prev.categories[0] === catId) return prev;
        return { ...prev, categories: [catId] };
      });
    }
  }, [location.search]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  // Sync Cart with API or LocalStorage
  useEffect(() => {
    if (cartLoaded) {
      if (token) {
        api.put('/cart', { items: cart }).catch(() => {});
      } else {
        saveCart(cart);
      }
      window.dispatchEvent(new Event('cart-updated'));
    }
  }, [cart, cartLoaded, token]);
  // Sync Wishlist with API or LocalStorage
  useEffect(() => {
    saveWishlist(wishlistKeys);
    if (token) {
      api.put('/auth/wishlist', { wishlistData: wishlistKeys }).catch(err => console.error('Failed to sync wishlist', err));
    }
  }, [wishlistKeys, token]);
  // Fetch Wishlist from API on login
  useEffect(() => {
    if (token && user) {
      api.get('/auth/me').then(res => {
        if (res.data?.wishlistData) {
          setWishlistKeys(res.data.wishlistData);
        }
      }).catch(err => console.error('Failed to fetch wishlist', err));
    }
  }, [token, user]);
  // Location-based product filtering (Amazon-style)
  const pincodeFilteredListings = useMemo(() => {
    if (!customerPincode.trim()) return listings;
    return listings.filter(l => {
      const wIds: string[] = (l as any).warehouseIds || [];
      if (wIds.length === 0) return false;
      const supplierWarehouses: any[] = (l as any).supplierWarehouses || [];
      const validWarehouse = supplierWarehouses.find((wh: any) => {
        if (!wIds.includes(wh.id)) return false;
        const pincodes: string[] = (wh as any).deliveryPincodes || [];
        if (pincodes.length > 0) {
          return pincodes.includes(customerPincode.trim());
        }
        return wh.pincode === customerPincode.trim();
      });
      return !!validWarehouse;
    });
  }, [listings, customerPincode]);
  const locationLabel = useMemo(() => {
    if (locationDetails?.city) {
      return customerPincode
        ? `${locationDetails.city} ${customerPincode}`
        : locationDetails.city;
    }
    return customerPincode;
  }, [locationDetails, customerPincode]);
  const facets = useMemo(() => buildFacets(pincodeFilteredListings), [pincodeFilteredListings]);
  const categoryChips: CategoryChip[] = useMemo(() => {
    const countByCat: Record<string, number> = {};
    pincodeFilteredListings.forEach(l => {
      countByCat[l.categoryId] = (countByCat[l.categoryId] ?? 0) + 1;
    });
    const chips: CategoryChip[] = [
      { id: 'all', label: 'All', icon: '🌊', image: '', count: pincodeFilteredListings.length },
    ];
    const sortedCats = [...categories].sort((a, b) => a.position - b.position);
    sortedCats.forEach(c => {
      const n = countByCat[c.id] ?? 0;
      chips.push({ id: c.id, label: c.name, icon: c.icon, image: c.image, count: n });
    });
    return chips;
  }, [pincodeFilteredListings, categories]);
  const filtered = useMemo(() => applyFilters(pincodeFilteredListings, filters), [pincodeFilteredListings, filters]);
  const displayedListings = useMemo(() => {
    if (showWishlistOnly) {
      return filtered.filter(l => wishlistKeys.includes(l.key));
    }
    return filtered;
  }, [filtered, showWishlistOnly, wishlistKeys]);
  const activeFilterCount = countActiveFilters(filters);
  const listingByKey = useMemo(() => {
    const map: Record<string, Listing> = {};
    listings.forEach(l => {
      map[l.key] = l;
    });
    return map;
  }, [listings]);
  const cartLines = useMemo(
    () =>
      Object.keys(cart)
        .map(key => ({ listing: listingByKey[key], qty: cart[key] }))
        .filter(x => x.listing && x.qty > 0),
    [cart, listingByKey]
  );
  const cartItemCount = cartLines.reduce((n, l) => n + l.qty, 0);
  const setQty = (key: string, qty: number) => {
    setCart(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[key];
      else next[key] = qty;
      return next;
    });
  };
  const inc = (key: string) => setQty(key, (cart[key] ?? 0) + 1);
  const dec = (key: string) => setQty(key, (cart[key] ?? 0) - 1);
  const toggleWishlist = (key: string) => {
    setWishlistKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };
  const clearFilters = () => {
    setFilters(emptyFilters());
    navigate('/products', { replace: true });
  };
  const toggleCategory = (id: string) => {
    if (id === 'all') {
      setFilters(f => ({ ...f, categories: [] }));
      navigate('/products', { replace: true });
      return;
    }
    setFilters(f => {
      const exists = f.categories.includes(id);
      const nextCats = exists ? [] : [id];
      return { ...f, categories: nextCats };
    });
    if (location.search) {
      navigate('/products', { replace: true });
    }
  };
  const detail = detailKey ? listingByKey[detailKey] ?? null : null;
  const detailSiblings = detail
    ? listings.filter(l => l.productId === detail.productId)
    : [];
  const detailQty = detail ? cart[detail.key] ?? 0 : 0;
  const handlePlaceOrder = () => {
    const count = cartItemCount;
    setCart({});
    setCartOpen(false);
    setNotice(
      `🎉 Order placed — ${count} item${count === 1 ? '' : 's'} on the way! Track it in My Orders.`
    );
  };
  const hasAnyFilter = activeFilterCount > 0 || filters.query.trim() !== '';
  const hasLocation = !!customerPincode.trim() || !!locationLabel;
  return (
    <div className="min-h-full bg-slate-50/60 pb-28">
      <CustomerProductsPageHeader
        query={filters.query}
        onQuery={q => setFilters(f => ({ ...f, query: q }))}
        sort={filters.sort}
        onSort={s => setFilters(f => ({ ...f, sort: s }))}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setSheetOpen(true)}
        categories={categoryChips}
        selectedCategories={filters.categories}
        onToggleCategory={toggleCategory}
        shownCount={displayedListings.length}
        totalCount={pincodeFilteredListings.length}
        customerPincode={customerPincode}
        locationLabel={locationLabel}
        onOpenLocationModal={() => setLocationModalOpen(true)}
      />
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        {/* Wishlist View Banner */}
        {showWishlistOnly && (
          <div className="mb-5 flex flex-col items-start justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <svg className="h-6 w-6 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-rose-700">My Wishlist</p>
                <p className="text-xs text-rose-500">{displayedListings.length} items saved</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-rose-600 shadow-sm transition hover:bg-rose-100"
            >
              View All Products
            </button>
          </div>
        )}
        {/* active filter pills */}
        {hasAnyFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {filters.query.trim() && (
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, query: '' }))}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                "{filters.query.trim()}" ✕
              </button>
            )}
            {filters.capacities.map(c => (
              <button
                key={c}
                type="button"
                onClick={() =>
                  setFilters(f => ({
                    ...f,
                    capacities: f.capacities.filter(x => x !== c),
                  }))
                }
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                {c} ✕
              </button>
            ))}
            {filters.temperatures.map(t => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setFilters(f => ({
                    ...f,
                    temperatures: f.temperatures.filter(x => x !== t),
                  }))
                }
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                {t} ✕
              </button>
            ))}
            {filters.brands.map(b => (
              <button
                key={b}
                type="button"
                onClick={() =>
                  setFilters(f => ({ ...f, brands: f.brands.filter(x => x !== b) }))
                }
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                {b} ✕
              </button>
            ))}
            {filters.subscriptionOnly && (
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, subscriptionOnly: false }))}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100"
              >
                🔁 Subscription ✕
              </button>
            )}
            {filters.maxPrice !== null && (
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, maxPrice: null }))}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                Under {inr(filters.maxPrice)} ✕
              </button>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-slate-400 transition hover:text-rose-500"
            >
              Clear all
            </button>
          </div>
        )}
        {/* product grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayedListings.map(l => (
            <ProductCard
              key={l.key}
              listing={l}
              qty={cart[l.key] ?? 0}
              onAdd={() => {
                inc(l.key);
                setNotice(`🛒 ${l.variantName || l.productName} added to cart.`);
              }}
              onInc={() => inc(l.key)}
              onDec={() => dec(l.key)}
              onOpen={() => setDetailKey(l.key)}
              wishlisted={wishlistKeys.includes(l.key)}
              onWishlistToggle={() => toggleWishlist(l.key)}
            />
          ))}
        </div>
        {displayedListings.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
              {showWishlistOnly ? '🤍' : '🔍'}
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {showWishlistOnly ? 'Your wishlist is empty' : 'No products match'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {showWishlistOnly
                ? 'Save items you love by clicking the heart icon on products.'
                : customerPincode.trim()
                  ? 'No products available for your pincode. Try changing your pincode or filters.'
                  : 'Try adjusting your search or filters to find what you need.'}
            </p>
            {showWishlistOnly ? (
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
              >
                Browse Products
              </button>
            ) : hasAnyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
        {!showWishlistOnly && <CustomerProductsPageTestimonials />}
      </div>
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        facets={facets}
        categoryOptions={categoryChips}
        resultCount={displayedListings.length}
        onClearAll={clearFilters}
      />
      {detail && (
        <ProductDetailModal
          listing={detail}
          siblings={detailSiblings}
          qty={detailQty}
          onInc={() => inc(detail.key)}
          onDec={() => dec(detail.key)}
          onClose={() => setDetailKey(null)}
          onSelect={l => setDetailKey(l.key)}
          onViewCart={() => {
            setCartOpen(true);
            setDetailKey(null);
          }}
        />
      )}
      <CartBar
        open={cartOpen}
        onOpen={() => setCartOpen(true)}
        onClose={() => setCartOpen(false)}
        lines={cartLines}
        onInc={inc}
        onDec={dec}
        onRemove={(key) => setQty(key, 0)}
        onClear={() => setCart({})}
        onPlaceOrder={handlePlaceOrder}
      />
      {notice && (
        <div className="fixed left-1/2 top-20 z-[60] w-[92%] max-w-sm -translate-x-1/2">
          <div className="animate-fade-in rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-800 shadow-xl">
            {notice}
          </div>
        </div>
      )}
      {/* Location Selector Modal */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !locating && setLocationModalOpen(false)}
          />
          <div className="animate-fade-in relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Choose delivery location</h3>
              </div>
              <button
                type="button"
                onClick={() => !locating && setLocationModalOpen(false)}
                disabled={locating}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>
            <div className="space-y-5 p-5">
              {/* Current location summary */}
              {hasLocation && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-emerald-600 text-lg">📍</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Currently delivering to</p>
                        <p className="text-sm font-bold text-emerald-800 truncate">
                          {locationDetails?.city
                            ? `${locationDetails.city}${customerPincode ? ', ' + customerPincode : ''}`
                            : customerPincode}
                        </p>
                        {locationDetails?.formatted && (
                          <p className="text-xs text-emerald-600 mt-0.5 truncate">{locationDetails.formatted}</p>
                        )}
                        <p className="text-xs font-semibold text-emerald-700 mt-1">
                          {pincodeFilteredListings.length} product{pincodeFilteredListings.length === 1 ? '' : 's'} available
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearLocation}
                      className="flex-shrink-0 text-xs font-bold text-rose-500 hover:text-rose-700 transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              {/* Pincode input */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Enter PIN code
                </label>
                <div className="mt-1.5 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={pincodeInputRef}
                      type="text"
                      inputMode="numeric"
                      value={modalPincode}
                      onChange={e => setModalPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={handlePincodeKeyDown}
                      placeholder="e.g. 500032"
                      maxLength={6}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-bold text-slate-800 placeholder-slate-300 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    {modalPincode.length === 6 && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyPincode}
                    disabled={modalPincode.length !== 6}
                    className="flex-shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              {/* Address search */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Search for area, street, or city
                </label>
                <div className="mt-1.5 relative">
                  <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Type to search..."
                    value={searchQuery}
                    onChange={handleSearchInput}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-300 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionRef}
                    className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s.place_id}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="block w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <svg className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-700 truncate">{s.display_name}</div>
                            {s.address.postcode && (
                              <div className="text-xs text-blue-600 font-semibold">PIN: {s.address.postcode}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              {/* Use my location */}
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                {locating ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Detecting your location...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2v20M2 12h20" />
                    </svg>
                    Use my current location
                  </>
                )}
              </button>
              {/* Error display */}
              {locationError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 flex items-start gap-2">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{locationError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomerProducts;
