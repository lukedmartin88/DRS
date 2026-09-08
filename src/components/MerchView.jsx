import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot
} from 'firebase/firestore';
import {
  ShoppingBag, Package, Truck, AlertCircle, Tag,
  ChevronLeft, Plus, Trash2, Edit3, X, CheckCircle2,
  RefreshCw, EyeOff, Sparkles, Filter, MapPin,
  Save, Check, CreditCard, Banknote
} from 'lucide-react';
import { DEFAULT_MERCH_PRODUCTS } from '../data/defaultMerch';

// Obsolete products from the legacy custom store that should be hidden
const OBSOLETE_PRODUCT_IDS = [
  'drs-laser-engraving',
  'drs-vinyl-signs',
  'drs-hoodie-blk',
  'drs-tee-blk',
  'drs-car-stickers'
];

// Reusable SumUp mounting widget for merchandise
const MerchSumUpWidget = React.memo(({ checkoutId, onSuccess, onFail }) => {
  const callbacks = useRef({ onSuccess, onFail });

  useEffect(() => {
    callbacks.current = { onSuccess, onFail };
  }, [onSuccess, onFail]);

  useEffect(() => {
    let instance = null;
    const uniqueContainerId = `sumup-merch-container-${checkoutId}`;

    if (checkoutId && window.SumUpCard) {
      const timer = setTimeout(() => {
        const container = document.getElementById(uniqueContainerId);
        if (container) {
          instance = window.SumUpCard.mount({
            id: uniqueContainerId,
            checkoutId: checkoutId,
            onResponse: (type, body) => {
              console.log('SumUp Merch Response:', type, body);
              if (type === 'success') {
                callbacks.current.onSuccess();
              } else if (type === 'fail' || type === 'error') {
                callbacks.current.onFail(body);
              }
            }
          });
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        if (instance && instance.unmount) {
          instance.unmount();
        }
      };
    }
  }, [checkoutId]);

  return (
    <div
      className="bg-white rounded-2xl p-4 min-h-[350px] shadow-2xl animate-in fade-in duration-500"
      id={`sumup-merch-container-${checkoutId}`}
    />
  );
});

// Main Customer Merchandise Store
export const MerchStoreView = ({
  isMerchActive,
  isAdmin,
  user,
  userProfile,
  db,
  storage,
  auth,
  appId,
  ImageUploadComponent,
  onNavigateToAdmin
}) => {
  const [products, setProducts] = useState(DEFAULT_MERCH_PRODUCTS);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState('meet_pickup'); // 'meet_pickup' | 'postal_delivery'
  const [paymentChoice, setPaymentChoice] = useState('sumup'); // 'sumup' | 'cash_meet'

  // Admin In-Store Product Editing State
  const [adminEditingProduct, setAdminEditingProduct] = useState(null);
  const [adminProductForm, setAdminProductForm] = useState({
    title: '',
    category: 'Clothing',
    price: 20.00,
    description: '',
    image: '',
    optionsLabel: 'Size',
    optionsText: 'S, M, L, XL, 2XL, 3XL',
    inStock: true,
    tag: ''
  });
  const [isAdminSavingProduct, setIsAdminSavingProduct] = useState(false);
  const [adminProductSaveSuccess, setAdminProductSaveSuccess] = useState('');
  const [adminProductSaveError, setAdminProductSaveError] = useState('');

  // Shipping & Contact Form State
  const [customerName, setCustomerName] = useState(userProfile?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Checkout State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [sumupCheckoutId, setSumupCheckoutId] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Sync products from Firestore and filter out obsolete products
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_products'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => !OBSOLETE_PRODUCT_IDS.includes(p.id) && !p.isPoa);

          if (list.length > 0) {
            setProducts(list);
          } else {
            setProducts(DEFAULT_MERCH_PRODUCTS);
          }
        } else {
          setProducts(DEFAULT_MERCH_PRODUCTS);
        }
      },
      (err) => console.error("Error loading merch products:", err)
    );
    return () => unsub();
  }, [db, appId]);

  // Update customer name / email if userProfile loads later
  useEffect(() => {
    if (userProfile?.name && !customerName) setCustomerName(userProfile.name);
    if (user?.email && !customerEmail) setCustomerEmail(user.email);
  }, [userProfile, user, customerName, customerEmail]);

  // Categories list
  const categories = useMemo(() => {
    const cats = ['All'];
    products.forEach(p => {
      if (p.category && !cats.includes(p.category)) cats.push(p.category);
    });
    return cats;
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter(p => p.category === activeCategory);
  }, [products, activeCategory]);

  const openOrderModal = (product) => {
    setSelectedProduct(product);
    setSelectedOption(product.options && product.options.length > 0 ? product.options[0] : '');
    setQuantity(1);
    setPaymentChoice('sumup');
    setCheckoutError('');
    setSumupCheckoutId(null);
    setCompletedOrder(null);
    setIsSubmitting(false);
  };

  const closeOrderModal = () => {
    setSelectedProduct(null);
    setSumupCheckoutId(null);
    setIsSubmitting(false);
  };

  // Lock body scroll and listen for Escape key when order modal is open
  useEffect(() => {
    if (!selectedProduct) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeOrderModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedProduct]);

  // Pricing calculations
  const unitPrice = selectedProduct ? (Number(selectedProduct.price) || 0) : 0;
  const itemsSubtotal = unitPrice * quantity;
  const shippingFee = fulfillmentType === 'postal_delivery' ? 3.99 : 0.00;
  const grandTotal = itemsSubtotal + shippingFee;

  // Toggle in-stock status (admin quick action)
  const handleToggleProductStock = async (product) => {
    if (!isAdmin) return;
    const nextStock = product.inStock === false;
    try {
      if (db && appId) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', product.id),
          { inStock: nextStock, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, inStock: nextStock } : p));
    } catch (err) {
      console.error("Error toggling stock:", err);
    }
  };

  // Open in-store admin editing modal
  const openAdminEditProduct = (product) => {
    setAdminEditingProduct(product);
    setAdminProductForm({
      title: product.title || '',
      category: product.category || 'Clothing',
      price: product.price ?? 20.00,
      description: product.description || '',
      image: product.image || '',
      optionsLabel: product.optionsLabel || 'Size',
      optionsText: (product.options || []).join(', '),
      inStock: product.inStock !== false,
      tag: product.tag || ''
    });
    setAdminProductSaveSuccess('');
    setAdminProductSaveError('');
  };

  // Save product edits
  const handleSaveAdminProduct = async (e) => {
    if (e) e.preventDefault();
    if (!adminEditingProduct) return;

    if (!adminProductForm.title.trim()) {
      setAdminProductSaveError("Please enter a product title.");
      return;
    }

    setIsAdminSavingProduct(true);
    setAdminProductSaveError('');
    setAdminProductSaveSuccess('');

    try {
      const parsedOptions = adminProductForm.optionsText
        ? adminProductForm.optionsText.split(',').map(o => o.trim()).filter(Boolean)
        : [];

      const payload = {
        id: adminEditingProduct.id,
        title: adminProductForm.title.trim(),
        category: adminProductForm.category || 'Clothing',
        price: parseFloat(adminProductForm.price) || 0,
        description: adminProductForm.description.trim(),
        image: adminProductForm.image.trim() || adminEditingProduct.image || '/merch/tshirt.svg',
        optionsLabel: adminProductForm.optionsLabel.trim() || 'Options',
        options: parsedOptions,
        inStock: Boolean(adminProductForm.inStock),
        tag: adminProductForm.tag.trim(),
        updatedAt: new Date().toISOString()
      };

      if (db && appId) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', adminEditingProduct.id),
          payload,
          { merge: true }
        );
      }

      setProducts(prev => {
        const idx = prev.findIndex(p => p.id === adminEditingProduct.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [payload, ...prev];
      });

      setAdminProductSaveSuccess("Product updated successfully!");
      setTimeout(() => {
        setAdminEditingProduct(null);
        setAdminProductSaveSuccess('');
      }, 600);
    } catch (err) {
      console.error("Error saving merchandise changes:", err);
      setAdminProductSaveError("Failed to update merchandise: " + (err.message || 'Unknown error'));
    } finally {
      setIsAdminSavingProduct(false);
    }
  };

  // Start checkout or reserve for cash collection
  const handleStartCheckout = async (e) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;

    if (!customerName.trim()) {
      setCheckoutError('Please enter your full name');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setCheckoutError('Please provide a valid email address');
      return;
    }

    if (fulfillmentType === 'postal_delivery') {
      if (!streetAddress.trim() || !city.trim() || !postcode.trim()) {
        setCheckoutError('Please enter your full postal address (street, city, and postcode).');
        return;
      }
    }

    // CASH AT NEXT MEET FLOW (Direct Reservation)
    if (paymentChoice === 'cash_meet') {
      setIsSubmitting(true);
      setCheckoutError('');

      try {
        const orderData = {
          orderNumber: `DRS-${Math.floor(100000 + Math.random() * 900000)}`,
          createdAt: new Date().toISOString(),
          customerId: user?.uid || 'guest',
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || null,
          product: {
            id: selectedProduct.id,
            title: selectedProduct.title,
            price: selectedProduct.price,
            category: selectedProduct.category,
            image: selectedProduct.image,
            selectedOption: selectedOption || null,
            quantity: quantity
          },
          itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
          shippingFee: 0,
          grandTotal: Number(itemsSubtotal.toFixed(2)),
          fulfillmentType: 'meet_pickup',
          orderNotes: orderNotes.trim() || null,
          paymentMethod: 'CASH_OR_CARD_ON_COLLECTION',
          paymentStatus: 'UNPAID',
          fulfillmentStatus: 'Awaiting Collection'
        };

        if (db && appId) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'merch_orders'), orderData);
        }
        setCompletedOrder(orderData);
      } catch (err) {
        console.error("Failed to reserve order:", err);
        setCheckoutError(err.message || 'Failed to complete reservation. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // SECURE SUMUP ONLINE PAYMENT FLOW
    setIsSubmitting(true);
    setCheckoutError('');

    try {
      const orderRef = `DRS-MERCH-${Date.now().toString(36).toUpperCase()}`;
      const description = `DRS: ${selectedProduct.title} (x${quantity}${selectedOption ? ` - ${selectedOption}` : ''})`;

      const res = await fetch(
        'https://createsumupcheckout-7hvlzmnlea-uc.a.run.app',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: orderRef,
            amount: Number(grandTotal.toFixed(2)),
            description: `${customerName}: ${description}`
          })
        }
      );

      if (!res.ok) throw new Error(`SumUp server returned status ${res.status}`);
      const data = await res.json();

      if (data.checkoutId) {
        setSumupCheckoutId(data.checkoutId);
      } else {
        throw new Error('No checkout ID returned from SumUp');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError(err.message || 'Payment service error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Payment Success Handler (SumUp)
  const handlePaymentSuccess = async () => {
    try {
      const orderData = {
        orderNumber: `DRS-${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: new Date().toISOString(),
        customerId: user?.uid || 'guest',
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim() || null,
        product: {
          id: selectedProduct.id,
          title: selectedProduct.title,
          price: selectedProduct.price,
          category: selectedProduct.category,
          image: selectedProduct.image,
          selectedOption: selectedOption || null,
          quantity: quantity
        },
        itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
        shippingFee: Number(shippingFee.toFixed(2)),
        grandTotal: Number(grandTotal.toFixed(2)),
        fulfillmentType: fulfillmentType,
        orderNotes: orderNotes.trim() || null,
        shippingAddress: fulfillmentType === 'postal_delivery' ? {
          street: streetAddress.trim(),
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
          country: 'United Kingdom'
        } : null,
        sumupCheckoutId: sumupCheckoutId,
        paymentMethod: 'SUMUP_CARD',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'Pending'
      };

      if (db && appId) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'merch_orders'), orderData);
      }
      setCompletedOrder(orderData);
      setSumupCheckoutId(null);
    } catch (err) {
      console.error("Error saving completed order:", err);
      setCompletedOrder({
        orderNumber: `DRS-${Date.now().toString().slice(-6)}`,
        customerName,
        customerEmail,
        product: {
          title: selectedProduct.title,
          quantity,
          selectedOption
        },
        grandTotal,
        fulfillmentType
      });
      setSumupCheckoutId(null);
    }
  };

  const handlePaymentFail = (body) => {
    console.error('Payment failed:', body);
    setCheckoutError('Payment was not completed or was cancelled. You can try again.');
    setSumupCheckoutId(null);
  };

  // Store Closed Banner if inactive and not admin
  if (!isMerchActive && !isAdmin) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto py-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 md:p-14 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-lime-400 to-pink-500"></div>
          <div className="w-20 h-20 bg-zinc-800/80 border border-zinc-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner text-lime-400">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic mb-4">
            Merchandise Store <span className="text-pink-500 not-italic">Currently Closed</span>
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-base leading-relaxed mb-8">
            The official Daily Ride South apparel and merch store is currently offline while our team prepares the next club drop. Check back soon or catch us at the next scheduled meet!
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => window.location.hash = 'events'}
              className="bg-lime-500 hover:bg-lime-400 text-black font-black px-6 py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-lime-500/20"
            >
              Browse Upcoming Meets
            </button>
            <button
              onClick={() => window.location.hash = 'home'}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-6 py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all border border-zinc-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Admin Preview Notice */}
      {!isMerchActive && isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <EyeOff className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-amber-300 font-bold text-xs uppercase tracking-wider">
                Store is Inactive (Admin Preview Mode)
              </p>
              <p className="text-zinc-400 text-xs">
                Only verified admins can see this page right now. Activate it in the Admin Control Panel whenever you are ready to accept orders.
              </p>
            </div>
          </div>
          {onNavigateToAdmin && (
            <button
              onClick={onNavigateToAdmin}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl transition-all whitespace-nowrap shadow-md"
            >
              Go to Admin Toggle
            </button>
          )}
        </div>
      )}

      {/* Header Banner */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-2xl overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none text-lime-400">
          <ShoppingBag className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-lime-500/10 border border-lime-500/30 px-3 py-1 rounded-full text-lime-400 text-[10px] font-bold uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Official DRS Merch Drop
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter italic">
            Club <span className="text-pink-500 not-italic">Merch</span> &amp; <span className="text-lime-400 not-italic">Apparel</span>
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm max-w-xl leading-relaxed">
            Support Daily Ride South with our official club merchandise. Pick up free at any DRS meet or order with UK tracked postal delivery.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 bg-black/40 border border-zinc-800/80 p-3 rounded-2xl">
          <div className="bg-lime-500/10 text-lime-400 p-2.5 rounded-xl border border-lime-500/20">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-white text-xs font-bold uppercase tracking-wider">Meet Pickup or UK Post</p>
            <p className="text-zinc-500 text-[10px] tracking-wide">SumUp Card or Cash at Meet</p>
          </div>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-4">
        <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mr-2 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Category:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeCategory === cat
                ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            {cat}
          </button>
        ))}

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setAdminEditingProduct({ id: `drs-prod-${Date.now()}` });
              setAdminProductForm({
                title: '',
                category: activeCategory !== 'All' ? activeCategory : 'Clothing',
                price: 20.00,
                description: '',
                image: '',
                optionsLabel: 'Size',
                optionsText: 'S, M, L, XL, 2XL, 3XL',
                inStock: true,
                tag: 'New'
              });
              setAdminProductSaveSuccess('');
              setAdminProductSaveError('');
            }}
            className="sm:ml-auto bg-lime-500 hover:bg-lime-400 text-black px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl hover:border-lime-500/40 transition-all flex flex-col group"
          >
            {/* Product Image */}
            <div className="relative h-60 md:h-64 overflow-hidden bg-black flex items-center justify-center">
              <img
                src={product.image}
                alt={product.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-75" />

              {/* Tag Badge */}
              {product.tag && (
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-lime-500/40 text-lime-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                  {product.tag}
                </div>
              )}

              {/* Price & Stock Badge */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <span className="bg-lime-500 text-black font-black text-base md:text-lg px-3.5 py-1 rounded-xl shadow-xl">
                  £{Number(product.price).toFixed(2)}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-md border ${
                  product.inStock !== false 
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-950/80 text-rose-400 border-rose-500/30'
                }`}>
                  {product.inStock !== false ? 'In Stock' : 'Sold Out'}
                </span>
              </div>
            </div>

            {/* Product Details */}
            <div className="p-6 flex flex-col flex-grow justify-between space-y-4">
              <div>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                  {product.category}
                </p>
                <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-lime-400 transition-colors">
                  {product.title}
                </h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-2 line-clamp-2">
                  {product.description}
                </p>
              </div>

              {/* Options Preview */}
              {product.options && product.options.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-zinc-400 text-xs">
                  <span className="font-semibold text-[11px] uppercase tracking-wider text-zinc-500">{product.optionsLabel || 'Options'}:</span>
                  <span className="text-zinc-400 text-[11px] font-mono truncate max-w-[180px]">
                    {product.options.join(' • ')}
                  </span>
                </div>
              )}

              {/* Order Button */}
              <button
                onClick={() => openOrderModal(product)}
                disabled={product.inStock === false}
                className={`w-full font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                  product.inStock === false
                    ? 'bg-zinc-800 text-zinc-500 opacity-40 cursor-not-allowed'
                    : 'bg-zinc-800 hover:bg-lime-500 text-white hover:text-black group-hover:shadow-lime-500/20 active:scale-[0.99]'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                {product.inStock !== false ? 'Order Now' : 'Currently Sold Out'}
              </button>

              {/* Admin In-Store Quick Actions */}
              {isAdmin && (
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleProductStock(product)}
                    className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                      product.inStock !== false
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30 hover:bg-rose-950/60 hover:text-rose-300'
                        : 'bg-rose-950/60 text-rose-400 border-rose-500/30 hover:bg-emerald-950/60 hover:text-emerald-300'
                    }`}
                  >
                    {product.inStock !== false ? 'In Stock (Toggle)' : 'Sold Out (Toggle)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAdminEditProduct(product)}
                    className="bg-lime-500 hover:bg-lime-400 text-black font-black text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Product Order Modal */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 md:p-8 my-8 shadow-2xl space-y-6">
            <button
              onClick={closeOrderModal}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full transition-colors border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            {completedOrder ? (
              /* Order Completed Screen */
              <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-lime-500/10 border-2 border-lime-500/30 text-lime-400 rounded-full flex items-center justify-center mx-auto shadow-xl">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <span className="bg-lime-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                    {completedOrder.paymentStatus === 'PAID' ? 'Payment Confirmed' : 'Order Reserved'}
                  </span>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic mt-3">
                    Thank You for Your Order!
                  </h2>
                  <p className="text-zinc-400 text-xs md:text-sm mt-1">
                    Order Ref: <span className="font-mono text-lime-400 font-bold">{completedOrder.orderNumber}</span>
                  </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left space-y-3">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Item:</span>
                    <span className="text-white font-black text-sm">
                      {completedOrder.product.title} (x{completedOrder.product.quantity}
                      {completedOrder.product.selectedOption ? ` - ${completedOrder.product.selectedOption}` : ''})
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Fulfillment:</span>
                    <span className="text-lime-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      {completedOrder.fulfillmentType === 'meet_pickup' ? (
                        <><MapPin className="w-3.5 h-3.5" /> Collection at Next DRS Meet</>
                      ) : (
                        <><Truck className="w-3.5 h-3.5" /> UK Postal Delivery</>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Payment Method:</span>
                    <span className="text-white font-bold text-xs uppercase tracking-wider">
                      {completedOrder.paymentMethod === 'SUMUP_CARD' ? 'Paid Online (SumUp)' : 'Cash / Card on Meet Collection'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Total:</span>
                    <span className="text-lime-400 font-black text-lg">
                      £{Number(completedOrder.grandTotal).toFixed(2)}
                    </span>
                  </div>
                </div>

                <p className="text-zinc-400 text-xs leading-relaxed max-w-md mx-auto">
                  A receipt and confirmation have been recorded for <span className="text-white font-bold">{completedOrder.customerEmail}</span>. The club organizers have received your order details.
                </p>

                <button
                  onClick={closeOrderModal}
                  className="bg-lime-500 hover:bg-lime-400 text-black font-black px-8 py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-lime-500/20"
                >
                  Done
                </button>
              </div>
            ) : sumupCheckoutId ? (
              /* SumUp Card Payment Widget */
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center space-y-1">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                    Step 2 of 2: Secure Payment
                  </span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                    Complete Card Payment
                  </h3>
                  <p className="text-zinc-400 text-xs">
                    Total Amount: <span className="text-lime-400 font-bold text-sm font-mono">£{grandTotal.toFixed(2)}</span>
                  </p>
                </div>

                <MerchSumUpWidget
                  checkoutId={sumupCheckoutId}
                  onSuccess={handlePaymentSuccess}
                  onFail={handlePaymentFail}
                />

                <div className="flex justify-between items-center pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSumupCheckoutId(null)}
                    className="text-zinc-400 hover:text-white transition-colors underline flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Change Order Details
                  </button>
                  <button
                    type="button"
                    onClick={closeOrderModal}
                    className="text-zinc-400 hover:text-rose-400 transition-colors uppercase font-bold text-[11px] tracking-wider"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Simplified Order Form */
              <form onSubmit={handleStartCheckout} className="space-y-6">
                {/* Product Summary Header */}
                <div className="flex gap-4 items-start border-b border-zinc-800 pb-5">
                  <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-2xl overflow-hidden bg-black border border-zinc-800">
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                      {selectedProduct.category}
                    </span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">
                      {selectedProduct.title}
                    </h3>
                    <p className="text-lime-400 font-black text-xl pt-0.5">
                      £{unitPrice.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Options Selection (e.g. Size) */}
                {selectedProduct.options && selectedProduct.options.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Select {selectedProduct.optionsLabel || 'Size / Option'}:
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {selectedProduct.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedOption(opt)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all truncate text-center ${
                            selectedOption === opt
                              ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20 font-black'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Quantity:
                  </label>
                  <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-1.5 rounded-2xl w-fit">
                    <button
                      type="button"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <span className="text-white font-bold font-mono px-3 text-sm">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Fulfillment Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Collection / Delivery Method:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('meet_pickup')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                        fulfillmentType === 'meet_pickup'
                          ? 'bg-lime-500/10 border-lime-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${fulfillmentType === 'meet_pickup' ? 'text-lime-400' : 'text-zinc-500'}`} />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider text-white">Collect at Meet (FREE)</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Collect at next scheduled DRS meet</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFulfillmentType('postal_delivery')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                        fulfillmentType === 'postal_delivery'
                          ? 'bg-lime-500/10 border-lime-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <Truck className={`w-5 h-5 shrink-0 mt-0.5 ${fulfillmentType === 'postal_delivery' ? 'text-lime-400' : 'text-zinc-500'}`} />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider text-white">UK Postal Delivery (+£3.99)</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Tracked UK delivery to your door</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Your Contact Details:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Email Address *"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="tel"
                      placeholder="Mobile / Phone (Optional for collection SMS)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                    />
                  </div>

                  {/* Postal Address (if delivery selected) */}
                  {fulfillmentType === 'postal_delivery' && (
                    <div className="space-y-3 p-3.5 bg-zinc-900/60 rounded-2xl border border-zinc-800 animate-in fade-in">
                      <p className="text-[11px] font-bold text-lime-400 uppercase tracking-wider">
                        UK Postal Address:
                      </p>
                      <input
                        type="text"
                        placeholder="Street Address *"
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                        required
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Town / City *"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Postcode *"
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 uppercase"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <input
                      type="text"
                      placeholder="Order notes / meet collection notes (Optional)"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500"
                    />
                  </div>
                </div>

                {/* Payment Choice */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Payment Method:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('sumup')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        paymentChoice === 'sumup'
                          ? 'bg-lime-500/10 border-lime-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 ${paymentChoice === 'sumup' ? 'text-lime-400' : 'text-zinc-500'}`} />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider text-white">Pay Online Now</p>
                        <p className="text-[10px] text-zinc-400">Card / SumUp Secure</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentChoice('cash_meet');
                        setFulfillmentType('meet_pickup');
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        paymentChoice === 'cash_meet'
                          ? 'bg-lime-500/10 border-lime-500 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <Banknote className={`w-5 h-5 ${paymentChoice === 'cash_meet' ? 'text-lime-400' : 'text-zinc-500'}`} />
                      <div>
                        <p className="font-bold text-xs uppercase tracking-wider text-white">Pay at Next Meet</p>
                        <p className="text-[10px] text-zinc-400">Cash or card on pickup</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {checkoutError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Order Summary & Submit Button */}
                <div className="pt-2 border-t border-zinc-800 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-zinc-400 uppercase tracking-wider text-xs">Total Amount:</span>
                    <span className="text-lime-400 font-black text-2xl font-mono">
                      £{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-lime-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : paymentChoice === 'cash_meet' ? (
                      <><Check className="w-4 h-4" /> Reserve for Meet Collection (£{grandTotal.toFixed(2)})</>
                    ) : (
                      <><CreditCard className="w-4 h-4" /> Proceed to Secure Card Payment (£{grandTotal.toFixed(2)})</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Admin Edit Product Modal */}
      {adminEditingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 md:p-8 my-8 shadow-2xl space-y-6">
            <button
              onClick={() => setAdminEditingProduct(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full transition-colors border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="p-2.5 bg-lime-500/10 text-lime-400 rounded-2xl border border-lime-500/20">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {adminEditingProduct.title ? 'Edit Product' : 'Add New Product'}
                </h3>
                <p className="text-zinc-500 text-xs font-mono">{adminEditingProduct.id}</p>
              </div>
            </div>

            <form onSubmit={handleSaveAdminProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  value={adminProductForm.title}
                  onChange={e => setAdminProductForm({ ...adminProductForm, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  placeholder="e.g. DRS Windproof Jacket"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Category
                  </label>
                  <select
                    value={adminProductForm.category}
                    onChange={e => setAdminProductForm({ ...adminProductForm, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="Clothing">Clothing</option>
                    <option value="Headwear">Headwear</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Car Accessories">Car Accessories</option>
                    <option value="Bundles">Bundles</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Price (£ GBP) *
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={adminProductForm.price}
                    onChange={e => setAdminProductForm({ ...adminProductForm, price: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Image Path or URL
                </label>
                <input
                  type="text"
                  value={adminProductForm.image}
                  onChange={e => setAdminProductForm({ ...adminProductForm, image: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  placeholder="/merch/jacket.svg or https://..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Options (Comma-separated)
                </label>
                <input
                  type="text"
                  value={adminProductForm.optionsText}
                  onChange={e => setAdminProductForm({ ...adminProductForm, optionsText: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  placeholder="S, M, L, XL, 2XL, 3XL"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Tag / Badge
                  </label>
                  <input
                    type="text"
                    value={adminProductForm.tag}
                    onChange={e => setAdminProductForm({ ...adminProductForm, tag: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                    placeholder="Bestseller, Weatherproof"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminProductForm.inStock}
                      onChange={e => setAdminProductForm({ ...adminProductForm, inStock: e.target.checked })}
                      className="rounded border-zinc-700 text-lime-500 focus:ring-lime-500 w-4 h-4 bg-zinc-900"
                    />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">In Stock</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={adminProductForm.description}
                  onChange={e => setAdminProductForm({ ...adminProductForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-lime-500 resize-none"
                  placeholder="Product description..."
                />
              </div>

              {adminProductSaveError && (
                <p className="text-rose-400 text-xs font-bold">{adminProductSaveError}</p>
              )}
              {adminProductSaveSuccess && (
                <p className="text-emerald-400 text-xs font-bold">{adminProductSaveSuccess}</p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAdminEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdminSavingProduct}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-lime-500 hover:bg-lime-400 text-black shadow-lg shadow-lime-500/20 transition-all flex items-center gap-2"
                >
                  {isAdminSavingProduct ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Admin Merchandise Control Panel Section
export const AdminMerchSection = ({
  isMerchActive,
  onToggleMerchActive,
  db,
  storage,
  auth,
  appId,
  ImageUploadComponent
}) => {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products'
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState(DEFAULT_MERCH_PRODUCTS);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncingDefaults, setIsSyncingDefaults] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Editing or creating product modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    title: '',
    category: 'Clothing',
    price: 20.00,
    description: '',
    image: '',
    optionsLabel: 'Size',
    optionsText: 'S, M, L, XL, 2XL, 3XL',
    inStock: true,
    tag: ''
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Load orders
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_orders'),
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setOrders(list);
      },
      (err) => console.error("Error loading merch orders:", err)
    );
    return () => unsub();
  }, [db, appId]);

  // Load products
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_products'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => !OBSOLETE_PRODUCT_IDS.includes(p.id) && !p.isPoa);

          if (list.length > 0) {
            setProducts(list);
          } else {
            setProducts(DEFAULT_MERCH_PRODUCTS);
          }
        } else {
          setProducts(DEFAULT_MERCH_PRODUCTS);
        }
      },
      (err) => console.error("Error loading products:", err)
    );
    return () => unsub();
  }, [db, appId]);

  // Sync / Reset to official price list
  const handleSyncOfficialList = async () => {
    if (!db || !appId) return;
    if (!window.confirm("Sync all 9 official products and 4 bundles to Firestore? This will update the catalogue to the official price list.")) {
      return;
    }
    setIsSyncingDefaults(true);
    setSyncStatusMsg('Syncing official price list...');

    try {
      // Write each default product
      for (const prod of DEFAULT_MERCH_PRODUCTS) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', prod.id),
          { ...prod, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }

      // Delete obsolete products from Firestore if they exist
      for (const obsId of OBSOLETE_PRODUCT_IDS) {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', obsId));
        } catch (e) {
          // ignore if already deleted
        }
      }

      setSyncStatusMsg('Successfully updated to official price list!');
      setTimeout(() => setSyncStatusMsg(''), 3000);
    } catch (err) {
      console.error("Sync error:", err);
      setSyncStatusMsg('Sync error: ' + err.message);
    } finally {
      setIsSyncingDefaults(false);
    }
  };

  // Toggle inStock
  const handleToggleStock = async (product) => {
    const nextVal = product.inStock === false;
    try {
      if (db && appId) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', product.id),
          { inStock: nextVal, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, inStock: nextVal } : p));
    } catch (err) {
      console.error("Error toggling stock:", err);
    }
  };

  // Update order status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      if (db && appId) {
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_orders', orderId),
          { fulfillmentStatus: newStatus, updatedAt: new Date().toISOString() }
        );
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, fulfillmentStatus: newStatus } : o));
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to remove this product?")) return;
    try {
      if (db && appId) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', productId));
      }
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err) {
      console.error("Error deleting product:", err);
    }
  };

  // Open edit modal
  const handleOpenEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      title: product.title || '',
      category: product.category || 'Clothing',
      price: product.price ?? 20.00,
      description: product.description || '',
      image: product.image || '',
      optionsLabel: product.optionsLabel || 'Size',
      optionsText: (product.options || []).join(', '),
      inStock: product.inStock !== false,
      tag: product.tag || ''
    });
    setSaveError('');
    setSaveSuccess('');
  };

  // Save product from admin section
  const handleSaveProduct = async (e) => {
    if (e) e.preventDefault();
    if (!editingProduct) return;

    if (!productForm.title.trim()) {
      setSaveError("Please enter a title.");
      return;
    }

    setIsSavingProduct(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const parsedOptions = productForm.optionsText
        ? productForm.optionsText.split(',').map(o => o.trim()).filter(Boolean)
        : [];

      const payload = {
        id: editingProduct.id,
        title: productForm.title.trim(),
        category: productForm.category || 'Clothing',
        price: parseFloat(productForm.price) || 0,
        description: productForm.description.trim(),
        image: productForm.image.trim() || editingProduct.image || '/merch/tshirt.svg',
        optionsLabel: productForm.optionsLabel.trim() || 'Options',
        options: parsedOptions,
        inStock: Boolean(productForm.inStock),
        tag: productForm.tag.trim(),
        updatedAt: new Date().toISOString()
      };

      if (db && appId) {
        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', editingProduct.id),
          payload,
          { merge: true }
        );
      }

      setProducts(prev => {
        const idx = prev.findIndex(p => p.id === editingProduct.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [payload, ...prev];
      });

      setSaveSuccess("Product saved successfully!");
      setTimeout(() => {
        setEditingProduct(null);
        setSaveSuccess('');
      }, 600);
    } catch (err) {
      console.error("Save error:", err);
      setSaveError("Failed to save product: " + (err.message || 'Unknown error'));
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (filterStatus !== 'All' && order.fulfillmentStatus !== filterStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ref = (order.orderNumber || '').toLowerCase();
        const name = (order.customerName || '').toLowerCase();
        const email = (order.customerEmail || '').toLowerCase();
        const item = (order.product?.title || '').toLowerCase();
        return ref.includes(q) || name.includes(q) || email.includes(q) || item.includes(q);
      }
      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-lime-500"></div>

      {/* Header & Main Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-lime-500/10 border border-lime-500/30 px-3 py-0.5 rounded-full text-lime-400 text-[10px] font-bold uppercase tracking-widest mb-1">
            Store Management
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-lime-400" /> Merchandise Control
          </h3>
          <p className="text-zinc-400 text-xs mt-1">
            Manage your store availability, orders, and products.
          </p>
        </div>

        {/* Global Store Switch */}
        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Store Availability</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isMerchActive ? 'text-lime-400' : 'text-rose-400'}`}>
              {isMerchActive ? 'Online (Accepting Orders)' : 'Closed (Admin Preview)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleMerchActive}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              isMerchActive ? 'bg-lime-500' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`bg-black w-6 h-6 rounded-full shadow-md transform transition-transform ${
                isMerchActive ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            Products ({products.length})
          </button>
        </div>

        {/* Sync button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncOfficialList}
            disabled={isSyncingDefaults}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors flex items-center gap-1.5"
            title="Reset/write all official price list products into Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDefaults ? 'animate-spin' : ''}`} />
            Sync Official Price List
          </button>
          {syncStatusMsg && (
            <span className="text-xs text-lime-400 font-bold">{syncStatusMsg}</span>
          )}
        </div>
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <input
              type="text"
              placeholder="Search by order ref, customer name, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 w-full sm:w-72"
            />
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['All', 'Pending', 'Awaiting Collection', 'Fulfilled', 'Cancelled'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                    filterStatus === st
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-zinc-950/60 rounded-2xl border border-zinc-800 text-zinc-500 text-xs">
              No orders found matching your search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lime-400 font-bold text-xs bg-lime-500/10 px-2 py-0.5 rounded border border-lime-500/20">
                        {order.orderNumber || order.id}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {order.paymentStatus || 'UNPAID'}
                      </span>
                      <span className="text-zinc-500 text-[10px]">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : ''}
                      </span>
                    </div>

                    <p className="text-white font-black text-sm">
                      {order.product?.title || 'Merch Item'} (x{order.product?.quantity || 1}
                      {order.product?.selectedOption ? ` - ${order.product.selectedOption}` : ''})
                    </p>

                    <div className="text-zinc-400 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>👤 {order.customerName}</span>
                      <span>✉️ {order.customerEmail}</span>
                      {order.customerPhone && <span>📞 {order.customerPhone}</span>}
                    </div>

                    {order.fulfillmentType === 'postal_delivery' && order.shippingAddress && (
                      <p className="text-zinc-400 text-[11px]">
                        📦 <strong>Post:</strong> {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.postcode}
                      </p>
                    )}
                    {order.orderNotes && (
                      <p className="text-zinc-500 text-[11px] italic">
                        Note: &ldquo;{order.orderNotes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex sm:flex-col items-end gap-2 shrink-0">
                    <span className="text-lime-400 font-black text-lg font-mono">
                      £{Number(order.grandTotal || 0).toFixed(2)}
                    </span>
                    <select
                      value={order.fulfillmentStatus || 'Pending'}
                      onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-lime-500"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Awaiting Collection">Awaiting Collection</option>
                      <option value="Fulfilled">Fulfilled</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-zinc-400 text-xs">
              Showing active merchandise products ({products.length})
            </p>
            <button
              onClick={() => {
                setEditingProduct({ id: `drs-prod-${Date.now()}` });
                setProductForm({
                  title: '',
                  category: 'Clothing',
                  price: 20.00,
                  description: '',
                  image: '',
                  optionsLabel: 'Size',
                  optionsText: 'S, M, L, XL, 2XL, 3XL',
                  inStock: true,
                  tag: 'New'
                });
                setSaveError('');
                setSaveSuccess('');
              }}
              className="bg-lime-500 hover:bg-lime-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(prod => (
              <div
                key={prod.id}
                className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex gap-3 items-start">
                  <div className="w-16 h-16 rounded-xl bg-black border border-zinc-800 overflow-hidden shrink-0">
                    <img
                      src={prod.image}
                      alt={prod.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500">
                      {prod.category}
                    </span>
                    <h4 className="text-sm font-black text-white truncate">
                      {prod.title}
                    </h4>
                    <p className="text-lime-400 font-bold text-sm">
                      £{Number(prod.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStock(prod)}
                    className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border transition-colors ${
                      prod.inStock !== false
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {prod.inStock !== false ? 'In Stock' : 'Sold Out'}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditProduct(prod)}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="p-1.5 bg-zinc-800 hover:bg-rose-900/60 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Edit Modal from Admin Section */}
      {editingProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl max-w-md w-full p-6 my-8 shadow-2xl space-y-4">
            <button
              onClick={() => setEditingProduct(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-full border border-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              {editingProduct.title ? 'Edit Product' : 'Add New Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={productForm.title}
                  onChange={e => setProductForm({ ...productForm, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Category
                  </label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  >
                    <option value="Clothing">Clothing</option>
                    <option value="Headwear">Headwear</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Car Accessories">Car Accessories</option>
                    <option value="Bundles">Bundles</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Image URL or Path
                </label>
                <input
                  type="text"
                  value={productForm.image}
                  onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                  placeholder="/merch/jacket.svg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Options (Comma-separated)
                </label>
                <input
                  type="text"
                  value={productForm.optionsText}
                  onChange={e => setProductForm({ ...productForm, optionsText: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Tag / Badge
                  </label>
                  <input
                    type="text"
                    value={productForm.tag}
                    onChange={e => setProductForm({ ...productForm, tag: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500"
                    placeholder="Bestseller"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.inStock}
                      onChange={e => setProductForm({ ...productForm, inStock: e.target.checked })}
                      className="rounded border-zinc-700 text-lime-500 focus:ring-lime-500 w-4 h-4 bg-zinc-900"
                    />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">In Stock</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-lime-500 resize-none"
                />
              </div>

              {saveError && <p className="text-rose-400 text-xs font-bold">{saveError}</p>}
              {saveSuccess && <p className="text-emerald-400 text-xs font-bold">{saveSuccess}</p>}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-lime-500 hover:bg-lime-400 text-black shadow-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchStoreView;
