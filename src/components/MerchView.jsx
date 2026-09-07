import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, getDocs
} from 'firebase/firestore';
import {
  ShoppingBag, Package, Truck, AlertCircle, Tag,
  ChevronLeft, Plus, Trash2, Edit3, X, CheckCircle2,
  RefreshCw, EyeOff, Sparkles, Filter, MapPin, Phone, Mail
} from 'lucide-react';
import { DEFAULT_MERCH_PRODUCTS } from '../data/defaultMerch';

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

export const MerchStoreView = ({
  isMerchActive,
  isAdmin,
  user,
  userProfile,
  db,
  appId,
  onNavigateToAdmin
}) => {
  const [products, setProducts] = useState(DEFAULT_MERCH_PRODUCTS);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState('meet_pickup'); // 'meet_pickup' | 'postal_delivery'
  
  // Shipping Form State
  const [customerName, setCustomerName] = useState(userProfile?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [meetNote, setMeetNote] = useState('');

  // Checkout State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [sumupCheckoutId, setSumupCheckoutId] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Sync products from Firestore if custom products exist
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_products'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setProducts(list);
        } else {
          setProducts(DEFAULT_MERCH_PRODUCTS);
        }
      },
      (err) => console.error("Error loading merch products:", err)
    );
    return () => unsub();
  }, [db, appId]);

  // Update customer name / email if userProfile changes
  useEffect(() => {
    if (userProfile?.name && !customerName) setCustomerName(userProfile.name);
    if (user?.email && !customerEmail) setCustomerEmail(user.email);
  }, [userProfile, user, customerName, customerEmail]);

  const categories = useMemo(() => {
    const cats = ['All'];
    products.forEach(p => {
      if (p.category && !cats.includes(p.category)) cats.push(p.category);
    });
    return cats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter(p => p.category === activeCategory);
  }, [products, activeCategory]);

  const openOrderModal = (product) => {
    setSelectedProduct(product);
    setSelectedOption(product.options && product.options.length > 0 ? product.options[0] : '');
    setQuantity(1);
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

  const shippingFee = fulfillmentType === 'postal_delivery' ? 3.99 : 0.00;
  const itemsSubtotal = selectedProduct ? (selectedProduct.price * quantity) : 0;
  const grandTotal = itemsSubtotal + shippingFee;

  const handleStartCheckout = async (e) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;

    if (!customerName.trim()) {
      setCheckoutError('Please enter your full name');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setCheckoutError('Please provide a valid email address for your order confirmation');
      return;
    }

    if (fulfillmentType === 'postal_delivery') {
      if (!streetAddress.trim() || !city.trim() || !postcode.trim()) {
        setCheckoutError('Please enter your complete postal address (street, town/city, and postcode).');
        return;
      }
    }

    setIsSubmitting(true);
    setCheckoutError('');

    try {
      const orderRef = `DRS-MERCH-${Date.now().toString(36).toUpperCase()}`;
      const description = `DRS Merch: ${selectedProduct.title} (x${quantity}${selectedOption ? ` - ${selectedOption}` : ''})`;

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

      if (!res.ok) throw new Error(`SumUp Server returned status ${res.status}`);
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
        meetNote: fulfillmentType === 'meet_pickup' ? (meetNote.trim() || 'Collect at next scheduled DRS meet') : null,
        shippingAddress: fulfillmentType === 'postal_delivery' ? {
          street: streetAddress.trim(),
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
          country: 'United Kingdom'
        } : null,
        sumupCheckoutId: sumupCheckoutId,
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
      // Still show the completed order screen even if firestore write failed
      setCompletedOrder({
        orderNumber: `DRS-${Date.now().toString().slice(-6)}`,
        customerName,
        customerEmail,
        product: { title: selectedProduct.title, quantity, selectedOption },
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

  // If Store is INACTIVE and user is NOT Admin, show closed banner
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
            The official Daily Ride South apparel and merch store is currently offline while our team prepares the next club drop. Check back soon or stay tuned to our announcements!
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
      {/* Admin Preview Notice if inactive */}
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

      {/* Hero Header */}
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
            Support the club in style. Choose free collection at our next meet or have your order delivered straight to your door with secure SumUp payments.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 bg-black/40 border border-zinc-800/80 p-3 rounded-2xl">
          <div className="bg-lime-500/10 text-lime-400 p-2.5 rounded-xl border border-lime-500/20">
            <Truck className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-white text-xs font-bold uppercase tracking-wider">Meet Collection or UK Post</p>
            <p className="text-zinc-500 text-[10px] tracking-wide">Paid securely via SumUp</p>
          </div>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-4">
        <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest mr-2 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Filter:
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
      </div>

      {/* Products Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl hover:border-lime-500/50 transition-all flex flex-col group"
          >
            <div className="relative h-56 md:h-64 overflow-hidden bg-black flex items-center justify-center">
              <img
                src={product.image}
                alt={product.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
              
              {product.tag && (
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-lime-500/40 text-lime-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                  {product.tag}
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <span className="bg-lime-500 text-black font-black text-base md:text-lg px-3 py-1 rounded-xl shadow-xl">
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

              {product.options && product.options.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between text-zinc-400 text-xs">
                  <span className="font-semibold">{product.optionsLabel || 'Options'}:</span>
                  <span className="text-zinc-500 text-[11px] font-mono">
                    {product.options.join(' • ')}
                  </span>
                </div>
              )}

              <button
                onClick={() => openOrderModal(product)}
                disabled={product.inStock === false}
                className="w-full bg-zinc-800 hover:bg-lime-500 text-white hover:text-black disabled:opacity-40 disabled:hover:bg-zinc-800 disabled:hover:text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg flex items-center justify-center gap-2 group-hover:shadow-lime-500/20"
              >
                <ShoppingBag className="w-4 h-4" />
                {product.inStock !== false ? 'Order / Buy Now' : 'Currently Sold Out'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Order Modal with SumUp Checkout */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl my-8">
            <button
              onClick={closeOrderModal}
              className="absolute top-6 right-6 p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
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
                    Payment Confirmed
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
                        <><MapPin className="w-3.5 h-3.5" /> Collection at DRS Meet</>
                      ) : (
                        <><Truck className="w-3.5 h-3.5" /> UK Postal Delivery</>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Total Paid:</span>
                    <span className="text-lime-400 font-black text-lg">
                      £{Number(completedOrder.grandTotal).toFixed(2)}
                    </span>
                  </div>
                </div>

                <p className="text-zinc-500 text-xs leading-relaxed max-w-md mx-auto">
                  A receipt has been sent to <span className="text-zinc-300 font-bold">{completedOrder.customerEmail}</span>. The club organizers have received your order details.
                </p>

                <button
                  onClick={closeOrderModal}
                  className="bg-lime-500 hover:bg-lime-400 text-black font-black px-8 py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-lime-500/20"
                >
                  Done
                </button>
              </div>
            ) : sumupCheckoutId ? (
              /* SumUp Card Payment Widget View */
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
                    onClick={() => setSumupCheckoutId(null)}
                    className="text-zinc-400 hover:text-white transition-colors underline flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Change Order Details
                  </button>
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                    Secured by SumUp Gateway
                  </span>
                </div>
              </div>
            ) : (
              /* Order Details & Sizing Form */
              <form onSubmit={handleStartCheckout} className="space-y-6">
                <div className="flex gap-4 items-start border-b border-zinc-800 pb-5">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.title}
                    loading="lazy"
                    decoding="async"
                    className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border border-zinc-800 shrink-0"
                  />
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                      {selectedProduct.category}
                    </span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {selectedProduct.title}
                    </h3>
                    <p className="text-lime-400 font-black text-lg">
                      £{Number(selectedProduct.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Option / Variant Selection (Sizes, Colors) */}
                {selectedProduct.options && selectedProduct.options.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Select {selectedProduct.optionsLabel || 'Option'}:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedOption(opt)}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border ${
                            selectedOption === opt
                              ? 'bg-lime-500 text-black border-lime-400 shadow-md shadow-lime-500/20 font-black'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Quantity
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black flex items-center justify-center transition-colors"
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-white text-base w-6 text-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-black flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Fulfillment Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Choose Delivery / Collection:
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFulfillmentType('meet_pickup')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        fulfillmentType === 'meet_pickup'
                          ? 'bg-lime-500/10 border-lime-500 text-white shadow-lg shadow-lime-500/10'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs uppercase tracking-wider text-white flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-lime-400" /> Meet Pickup
                        </span>
                        <span className="bg-lime-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                          FREE
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">Collect in person at the next official DRS meet.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFulfillmentType('postal_delivery')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        fulfillmentType === 'postal_delivery'
                          ? 'bg-lime-500/10 border-lime-500 text-white shadow-lg shadow-lime-500/10'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs uppercase tracking-wider text-white flex items-center gap-2">
                          <Truck className="w-4 h-4 text-lime-400" /> UK Postal Delivery
                        </span>
                        <span className="text-lime-400 font-mono text-xs font-bold">
                          +£3.99
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">Royal Mail standard tracked shipping to your home.</p>
                    </button>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Buyer Contact Details
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Mobile / Phone (for order updates)</label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="07123 456789"
                        className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address fields if postal */}
                {fulfillmentType === 'postal_delivery' && (
                  <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-zinc-800/80 animate-in fade-in duration-300">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-lime-400 flex items-center gap-1.5">
                      <Truck className="w-4 h-4" /> Shipping Address
                    </h4>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Street Address</label>
                      <input
                        type="text"
                        required
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder="12 High Street"
                        className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">City / Town</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Southampton"
                          className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Postcode</label>
                        <input
                          type="text"
                          required
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          placeholder="SO14 0AA"
                          className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none uppercase"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional meet note if pickup */}
                {fulfillmentType === 'meet_pickup' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      Car / Notes (Optional, helps us spot you at the meet)
                    </label>
                    <input
                      type="text"
                      value={meetNote}
                      onChange={(e) => setMeetNote(e.target.value)}
                      placeholder="e.g. Silver Golf R or Matt's Fiesta"
                      className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                    />
                  </div>
                )}

                {checkoutError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Price Breakdown & Confirm Button */}
                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Items Subtotal:</span>
                    <span className="font-mono">£{itemsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Shipping / Fulfillment:</span>
                    <span className="font-mono">
                      {shippingFee > 0 ? `£${shippingFee.toFixed(2)}` : 'FREE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base font-black text-white pt-2 border-t border-zinc-800/60">
                    <span>Total Due:</span>
                    <span className="text-lime-400 text-xl font-mono">
                      £{grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs shadow-xl shadow-lime-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Preparing Checkout...</>
                    ) : (
                      <><ShoppingBag className="w-4 h-4" /> Pay £{grandTotal.toFixed(2)} via SumUp</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   ADMIN MERCHANDISE MANAGEMENT SECTION (Inside Club Control Panel)
   Includes the requested Live / Inactive store toggle + Orders & Product Manager
   ========================================================================= */
export const AdminMerchSection = ({
  isMerchActive,
  onToggleMerchActive,
  db,
  appId
}) => {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'products'
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState(DEFAULT_MERCH_PRODUCTS);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Product edit / create modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    category: 'Hoodies',
    price: 25.00,
    description: '',
    image: '',
    optionsLabel: 'Size',
    optionsText: 'S, M, L, XL, 2XL',
    inStock: true,
    tag: ''
  });

  // Sync Orders from Firestore
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_orders'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setOrders(list);
      },
      (err) => console.error("Error fetching merch orders:", err)
    );
    return () => unsub();
  }, [db, appId]);

  // Sync Products from Firestore
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_products'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setProducts(list);
        }
      },
      (err) => console.error("Error fetching admin products:", err)
    );
    return () => unsub();
  }, [db, appId]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      if (!db || !appId) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_orders', orderId), {
        fulfillmentStatus: newStatus
      });
    } catch (err) {
      console.error("Failed to update order status:", err);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.title || !productForm.price) return;

    const parsedOptions = productForm.optionsText
      ? productForm.optionsText.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const productPayload = {
      title: productForm.title,
      category: productForm.category,
      price: Number(productForm.price),
      description: productForm.description,
      image: productForm.image || 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&q=80&w=800',
      optionsLabel: productForm.optionsLabel || 'Options',
      options: parsedOptions,
      inStock: productForm.inStock,
      tag: productForm.tag || ''
    };

    try {
      if (!db || !appId) return;
      if (editingProduct) {
        await updateDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', editingProduct.id),
          productPayload
        );
      } else {
        await addDoc(
          collection(db, 'artifacts', appId, 'public', 'data', 'merch_products'),
          productPayload
        );
      }
      setIsCreatingProduct(false);
      setEditingProduct(null);
    } catch (err) {
      console.error("Failed to save product:", err);
    }
  };

  const handleDeleteProduct = async (prodId) => {
    if (!window.confirm("Are you sure you want to delete this merchandise product?")) return;
    try {
      if (!db || !appId) return;
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', prodId));
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const handleSeedDefaults = async () => {
    if (!db || !appId) return;
    if (!window.confirm("Sync official DRS merchandise lineup (Laser Engraving, Vinyl Signs, Hoodie, T-Shirts, Car Stickers) to your database?")) return;
    try {
      // Clear legacy items if any
      const currentSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'merch_products'));
      for (const d of currentSnap.docs) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', d.id));
      }
      // Seed current 5 products
      for (const p of DEFAULT_MERCH_PRODUCTS) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', p.id), p);
      }
      alert("Merchandise catalog synchronized to official 5 products successfully!");
    } catch (err) {
      console.error("Failed to seed merch:", err);
      alert("Error syncing products: " + err.message);
    }
  };

  const pendingOrdersCount = orders.filter(o => o.fulfillmentStatus === 'Pending').length;

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchStatus = filterStatus === 'All' || o.fulfillmentStatus === filterStatus;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
        (o.product?.title && o.product.title.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [orders, filterStatus, searchQuery]);

  return (
    <section className="bg-zinc-900 p-6 md:p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${isMerchActive ? 'bg-lime-500' : 'bg-amber-500'}`} />

      {/* Header with Title & Active Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-lime-400" />
            <h3 className="text-xl font-black text-white uppercase tracking-widest">
              Club Merchandise &amp; Store Management
            </h3>
          </div>
          <p className="text-zinc-400 text-xs mt-1">
            Toggle your store live or inactive, view customer orders, and manage stock variants.
          </p>
        </div>

        {/* --- TOGGLE BUTTON TO MAKE MERCH PAGE LIVE OR INACTIVE --- */}
        <div className="bg-black/60 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              Merch Page Status
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isMerchActive ? 'bg-lime-400 shadow-[0_0_8px_rgba(125,220,9,0.8)]' : 'bg-amber-400'}`} />
              <span className={`text-sm font-black uppercase tracking-wider ${isMerchActive ? 'text-lime-400' : 'text-amber-400'}`}>
                {isMerchActive ? 'STORE IS LIVE' : 'STORE IS INACTIVE'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleMerchActive(!isMerchActive)}
            className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              isMerchActive
                ? 'bg-zinc-800 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-lime-500 hover:bg-lime-400 text-black shadow-lime-500/25'
            }`}
          >
            {isMerchActive ? 'Make Inactive' : 'Turn Store Live'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-lime-500 text-black shadow-md'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            Customer Orders
            {pendingOrdersCount > 0 && (
              <span className="bg-black text-lime-400 px-2 py-0.5 rounded-full text-[10px] font-black">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'products'
                ? 'bg-lime-500 text-black shadow-md'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            Products &amp; Inventory ({products.length})
          </button>
        </div>

        {activeTab === 'products' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSeedDefaults}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-zinc-700"
            >
              Reload DRS Catalog
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setProductForm({
                  title: '',
                  category: 'Clothing',
                  price: 25.00,
                  description: '',
                  image: '',
                  optionsLabel: 'Size',
                  optionsText: 'S, M, L, XL, 2XL',
                  inStock: true,
                  tag: 'New'
                });
                setIsCreatingProduct(true);
              }}
              className="bg-lime-500 hover:bg-lime-400 text-black font-black px-4 py-2 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        )}
      </div>

      {/* --- TAB CONTENT: ORDERS --- */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['All', 'Pending', 'Dispatched', 'Collected'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    filterStatus === st
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-800/50 text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search by name, order # or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black border border-zinc-800 text-white rounded-xl px-4 py-2 text-xs focus:border-lime-500 outline-none w-full sm:w-64"
            />
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-black/40 border border-zinc-800/80 rounded-2xl p-10 text-center space-y-2">
              <Package className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-white font-bold text-sm uppercase tracking-wider">No Orders Found</p>
              <p className="text-zinc-500 text-xs">
                {orders.length === 0
                  ? "When members order merchandise through the store, their orders will appear here automatically."
                  : "No orders match the selected filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-black/60 border border-zinc-800 rounded-2xl p-5 space-y-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-black text-lime-400 bg-lime-500/10 px-2.5 py-1 rounded-lg border border-lime-500/20">
                        {order.orderNumber || order.id}
                      </span>
                      <span className="text-zinc-400 text-xs">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        order.fulfillmentStatus === 'Pending'
                          ? 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                          : order.fulfillmentStatus === 'Dispatched'
                          ? 'bg-blue-950/80 text-blue-400 border-blue-500/40'
                          : 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                      }`}>
                        {order.fulfillmentStatus || 'Pending'}
                      </span>
                      <span className="text-zinc-400 font-mono text-xs font-black">
                        £{Number(order.grandTotal).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-xs">
                    {/* Customer */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Customer</p>
                      <p className="text-white font-bold">{order.customerName}</p>
                      <p className="text-zinc-400 flex items-center gap-1.5"><Mail className="w-3 h-3 text-zinc-500" /> {order.customerEmail}</p>
                      {order.customerPhone && (
                        <p className="text-zinc-400 flex items-center gap-1.5"><Phone className="w-3 h-3 text-zinc-500" /> {order.customerPhone}</p>
                      )}
                    </div>

                    {/* Item */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Product</p>
                      <p className="text-white font-bold">{order.product?.title || 'Club Merch'}</p>
                      <p className="text-zinc-400">
                        Qty: <span className="text-white font-bold">{order.product?.quantity || 1}</span>
                        {order.product?.selectedOption && ` • Variant: ${order.product.selectedOption}`}
                      </p>
                    </div>

                    {/* Fulfillment Details */}
                    <div className="space-y-1">
                      <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Fulfillment</p>
                      {order.fulfillmentType === 'meet_pickup' ? (
                        <div>
                          <p className="text-lime-400 font-bold flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Meet Pickup
                          </p>
                          <p className="text-zinc-400 italic text-[11px]">{order.meetNote || 'Collection at DRS meet'}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-blue-400 font-bold flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Postal Delivery
                          </p>
                          {order.shippingAddress ? (
                            <p className="text-zinc-300 text-[11px] leading-tight">
                              {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.postcode}
                            </p>
                          ) : (
                            <p className="text-zinc-500 italic">No postal address recorded</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-zinc-800/50 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      SumUp Ref: {order.sumupCheckoutId || 'Verified'}
                    </span>
                    <div className="flex items-center gap-2">
                      {order.fulfillmentStatus !== 'Dispatched' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Dispatched')}
                          className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Mark Dispatched
                        </button>
                      )}
                      {order.fulfillmentStatus !== 'Collected' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Collected')}
                          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Mark Collected
                        </button>
                      )}
                      {order.fulfillmentStatus !== 'Pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Pending')}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Revert to Pending
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: PRODUCTS --- */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-black/60 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between p-4 space-y-3"
              >
                <div className="flex gap-3">
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    decoding="async"
                    className="w-16 h-16 rounded-xl object-cover border border-zinc-800 shrink-0"
                  />
                  <div className="space-y-0.5 overflow-hidden">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block">
                      {p.category}
                    </span>
                    <h4 className="text-white font-black text-sm truncate">{p.title}</h4>
                    <p className="text-lime-400 font-mono font-bold text-xs">
                      £{Number(p.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/60 pt-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    p.inStock !== false ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                  }`}>
                    {p.inStock !== false ? 'In Stock' : 'Sold Out'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(p);
                        setProductForm({
                          title: p.title,
                          category: p.category || 'Clothing',
                          price: p.price,
                          description: p.description || '',
                          image: p.image || '',
                          optionsLabel: p.optionsLabel || 'Size',
                          optionsText: (p.options || []).join(', '),
                          inStock: p.inStock !== false,
                          tag: p.tag || ''
                        });
                        setIsCreatingProduct(true);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Edit Product"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-rose-400 hover:text-rose-300 transition-colors"
                      title="Delete Product"
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

      {/* Product Edit / Create Modal */}
      {isCreatingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl my-8">
            <button
              onClick={() => { setIsCreatingProduct(false); setEditingProduct(null); }}
              className="absolute top-6 right-6 p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">
              {editingProduct ? 'Edit Merchandise Product' : 'Add New Merchandise Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={e => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="e.g. DRS Windscreen Sunstrip"
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  >
                    <option value="Laser Engraving">Laser Engraving</option>
                    <option value="Vinyl Signs">Vinyl Signs</option>
                    <option value="Hoodies">Hoodies</option>
                    <option value="T-Shirts">T-Shirts</option>
                    <option value="Car Stickers">Car Stickers</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Price (£ GBP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Image URL or Asset Path</label>
                <input
                  type="text"
                  value={productForm.image}
                  onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                  placeholder="/merch/hoodie.svg or https://..."
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none mb-2"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase self-center mr-1">Quick Select:</span>
                  {[
                    { label: 'Laser Engraving', path: '/merch/laser-engraving.svg' },
                    { label: 'Vinyl Signs', path: '/merch/vinyl-signs.svg' },
                    { label: 'Hoodie', path: '/merch/hoodie.svg' },
                    { label: 'T-Shirts', path: '/merch/tshirt.svg' },
                    { label: 'Car Stickers', path: '/merch/car-stickers.svg' }
                  ].map(preset => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => setProductForm({ ...productForm, image: preset.path })}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                        productForm.image === preset.path
                          ? 'bg-lime-500 text-black border-lime-400'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Options Label</label>
                  <input
                    type="text"
                    value={productForm.optionsLabel}
                    onChange={e => setProductForm({ ...productForm, optionsLabel: e.target.value })}
                    placeholder="e.g. Size or Color"
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Badge / Tag (Optional)</label>
                  <input
                    type="text"
                    value={productForm.tag}
                    onChange={e => setProductForm({ ...productForm, tag: e.target.value })}
                    placeholder="e.g. New Drop or Bestseller"
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Options List (Comma separated)
                </label>
                <input
                  type="text"
                  value={productForm.optionsText}
                  onChange={e => setProductForm({ ...productForm, optionsText: e.target.value })}
                  placeholder="e.g. S, M, L, XL, 2XL"
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Product material, specs, fit..."
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="inStockCheck"
                  checked={productForm.inStock}
                  onChange={e => setProductForm({ ...productForm, inStock: e.target.checked })}
                  className="w-4 h-4 accent-lime-500 rounded"
                />
                <label htmlFor="inStockCheck" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer">
                  In Stock &amp; Available for Order
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsCreatingProduct(false); setEditingProduct(null); }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3 rounded-xl uppercase tracking-wider text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-lime-500 hover:bg-lime-400 text-black font-black py-3 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-lime-500/20"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
