import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, getDocs
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  ShoppingBag, Package, Truck, AlertCircle, Tag,
  ChevronLeft, Plus, Trash2, Edit3, X, CheckCircle2,
  RefreshCw, EyeOff, Sparkles, Filter, MapPin, Phone, Mail,
  Upload, UploadCloud, Image as ImageIcon, Camera, Save
} from 'lucide-react';
import { DEFAULT_MERCH_PRODUCTS } from '../data/defaultMerch';
import { DEFAULT_GALLERY_DESIGNS } from '../data/defaultDesigns';

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
  
  // Custom Design Variations (for Hoodies & T-Shirts)
  const [galleryDesigns, setGalleryDesigns] = useState(DEFAULT_GALLERY_DESIGNS);
  const [designMode, setDesignMode] = useState('standard'); // 'standard' | 'custom'
  const [selectedDesign, setSelectedDesign] = useState(DEFAULT_GALLERY_DESIGNS[0]);
  const [hasCustomUserImage, setHasCustomUserImage] = useState(false);
  const [customUserImageUrl, setCustomUserImageUrl] = useState('');
  const [customUserImageNotes, setCustomUserImageNotes] = useState('');
  const [isUploadingUserImage, setIsUploadingUserImage] = useState(false);
  const [userImageUploadProgress, setUserImageUploadProgress] = useState(0);
  const [userImageUploadError, setUserImageUploadError] = useState('');
  const userImageFileInputRef = useRef(null);

  // Shipping Form State
  const [customerName, setCustomerName] = useState(userProfile?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [meetNote, setMeetNote] = useState('');
  const [customDesignNotes, setCustomDesignNotes] = useState('');

  // Checkout State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [sumupCheckoutId, setSumupCheckoutId] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Helper to detect if a garment supports custom design variations
  const isApparelCustomizable = (prod) => {
    if (!prod) return false;
    if (prod.supportsCustomDesign) return true;
    const cat = (prod.category || '').toLowerCase();
    const title = (prod.title || '').toLowerCase();
    const id = (prod.id || '').toLowerCase();
    return (
      cat.includes('hoodie') ||
      cat.includes('t-shirt') ||
      cat.includes('tshirt') ||
      cat.includes('tee') ||
      id.includes('hoodie') ||
      id.includes('tee') ||
      title.includes('hoodie') ||
      title.includes('t-shirt')
    );
  };

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

  // Sync design gallery from Firestore (merch_designs)
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_designs'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const customIds = new Set(list.map(d => d.id));
          const combined = [...list, ...DEFAULT_GALLERY_DESIGNS.filter(d => !customIds.has(d.id))];
          setGalleryDesigns(combined);
        } else {
          setGalleryDesigns(DEFAULT_GALLERY_DESIGNS);
        }
      },
      (err) => console.error("Error loading merch gallery designs:", err)
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

  const openOrderModal = (product, initialCustomDesign = false) => {
    setSelectedProduct(product);
    setSelectedOption(product.options && product.options.length > 0 ? product.options[0] : '');
    setQuantity(1);
    setCustomDesignNotes('');
    setCheckoutError('');
    setSumupCheckoutId(null);
    setCompletedOrder(null);
    setIsSubmitting(false);

    // Set custom design state for customizable apparel
    const isApparel = isApparelCustomizable(product);
    setDesignMode(isApparel && initialCustomDesign ? 'custom' : 'standard');
    setSelectedDesign(galleryDesigns[0] || DEFAULT_GALLERY_DESIGNS[0]);
    setHasCustomUserImage(false);
    setCustomUserImageUrl('');
    setCustomUserImageNotes('');
    setUserImageUploadError('');
    setIsUploadingUserImage(false);
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

  // Customer photo upload handler (with Firebase Storage and dataURL fallback)
  const handleCustomerImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUserImageUploadError("Please choose a valid image file (PNG, JPG, WEBP, SVG).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUserImageUploadError("Image size must be under 15MB.");
      return;
    }

    setIsUploadingUserImage(true);
    setUserImageUploadProgress(0);
    setUserImageUploadError('');

    if (storage) {
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uid = user?.uid || 'guest';
        const storageRef = ref(storage, `artifacts/${appId || 'daily-ride-south'}/customer_merch_images/${uid}_${Date.now()}_${cleanName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snap) => {
            const prog = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUserImageUploadProgress(prog);
          },
          (err) => {
            console.warn("Storage upload failed, falling back to local data URL:", err);
            const fallbackReader = new FileReader();
            fallbackReader.onload = () => {
              setCustomUserImageUrl(fallbackReader.result);
              setIsUploadingUserImage(false);
            };
            fallbackReader.readAsDataURL(file);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setCustomUserImageUrl(downloadUrl);
            } catch (urlErr) {
              const fallbackReader = new FileReader();
              fallbackReader.onload = () => {
                setCustomUserImageUrl(fallbackReader.result);
              };
              fallbackReader.readAsDataURL(file);
            } finally {
              setIsUploadingUserImage(false);
              setUserImageUploadProgress(0);
            }
          }
        );
      } catch (uploadErr) {
        console.warn("Direct upload error, falling back to data URL:", uploadErr);
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => {
          setCustomUserImageUrl(fallbackReader.result);
          setIsUploadingUserImage(false);
        };
        fallbackReader.readAsDataURL(file);
      }
    } else {
      const fallbackReader = new FileReader();
      fallbackReader.onload = () => {
        setCustomUserImageUrl(fallbackReader.result);
        setIsUploadingUserImage(false);
        setUserImageUploadProgress(100);
      };
      fallbackReader.readAsDataURL(file);
    }
  };

  const isSelectedProductPoa = selectedProduct && (selectedProduct.isPoa || selectedProduct.price === 0);
  const isApparel = isApparelCustomizable(selectedProduct);
  const isCustomDesignActive = isApparel && designMode === 'custom';
  // £5 extra charge when customer opts to provide their own photo/image to be put into the design
  const customImageFee = (isCustomDesignActive && hasCustomUserImage) ? 5.00 : 0.00;

  const baseUnitPrice = selectedProduct ? selectedProduct.price : 0;
  const effectiveUnitPrice = baseUnitPrice + customImageFee;
  const itemsSubtotal = effectiveUnitPrice * quantity;
  const shippingFee = fulfillmentType === 'postal_delivery' ? 3.99 : 0.00;
  const grandTotal = isSelectedProductPoa ? 0 : (itemsSubtotal + shippingFee);

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
        setCheckoutError('Please enter your complete postal address (street, town/city, and postcode).');
        return;
      }
    }

    // Validation for custom image upload option (+£5)
    if (isCustomDesignActive && hasCustomUserImage && !customUserImageUrl.trim()) {
      setCheckoutError('Please upload an image or provide a link for your +£5 custom design option, or uncheck the custom image option.');
      return;
    }

    // --- POA / CUSTOM DESIGN QUOTE FLOW ---
    if (isSelectedProductPoa) {
      if (!customDesignNotes.trim()) {
        setCheckoutError('Please provide your custom design requirements (text to engrave, dog tag details, bookmark quote, or sign specifications).');
        return;
      }

      setIsSubmitting(true);
      setCheckoutError('');

      try {
        const orderData = {
          orderNumber: `POA-${Math.floor(100000 + Math.random() * 900000)}`,
          createdAt: new Date().toISOString(),
          customerId: user?.uid || 'guest',
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || null,
          product: {
            id: selectedProduct.id,
            title: selectedProduct.title,
            price: 0,
            isPoa: true,
            category: selectedProduct.category,
            image: selectedProduct.image,
            selectedOption: selectedOption || null,
            quantity: quantity,
            customDesignNotes: customDesignNotes.trim()
          },
          customDesignNotes: customDesignNotes.trim(),
          itemsSubtotal: 0,
          shippingFee: fulfillmentType === 'postal_delivery' ? 3.99 : 0.00,
          grandTotal: 0,
          isPoa: true,
          fulfillmentType: fulfillmentType,
          meetNote: fulfillmentType === 'meet_pickup' ? (meetNote.trim() || 'Collect at next scheduled DRS meet') : null,
          shippingAddress: fulfillmentType === 'postal_delivery' ? {
            street: streetAddress.trim(),
            city: city.trim(),
            postcode: postcode.trim().toUpperCase(),
            country: 'United Kingdom'
          } : null,
          paymentStatus: 'POA_INQUIRY',
          fulfillmentStatus: 'Quote Pending'
        };

        if (db && appId) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'merch_orders'), orderData);
        }
        setCompletedOrder(orderData);
      } catch (err) {
        console.error("Failed to submit custom quote request:", err);
        setCheckoutError(err.message || 'Failed to submit quote request. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // --- STANDARD FIXED PRICE SUMUP CHECKOUT FLOW ---
    setIsSubmitting(true);
    setCheckoutError('');

    try {
      const orderRef = `DRS-MERCH-${Date.now().toString(36).toUpperCase()}`;
      const designTag = isCustomDesignActive
        ? ` [Design: ${selectedDesign?.title || 'Custom'}${hasCustomUserImage ? ' + Custom Photo (£5)' : ''}]`
        : '';
      const description = `DRS Merch: ${selectedProduct.title} (x${quantity}${selectedOption ? ` - ${selectedOption}` : ''})${designTag}`;

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
          image: (isCustomDesignActive && selectedDesign?.image) ? selectedDesign.image : selectedProduct.image,
          selectedOption: selectedOption || null,
          quantity: quantity,
          designMode: isCustomDesignActive ? 'custom' : 'standard',
          selectedDesign: isCustomDesignActive ? {
            id: selectedDesign?.id,
            title: selectedDesign?.title,
            category: selectedDesign?.category,
            image: selectedDesign?.image
          } : null,
          hasCustomUserImage: Boolean(isCustomDesignActive && hasCustomUserImage),
          customUserImageUrl: (isCustomDesignActive && hasCustomUserImage) ? customUserImageUrl : null,
          customUserImageNotes: (isCustomDesignActive && hasCustomUserImage) ? customUserImageNotes : null,
          customImageFee: (isCustomDesignActive && hasCustomUserImage) ? 5.00 : 0
        },
        customDesignVariation: isCustomDesignActive ? (selectedDesign?.title || 'Custom Gallery Design') : null,
        hasCustomUserImage: Boolean(isCustomDesignActive && hasCustomUserImage),
        customUserImageUrl: (isCustomDesignActive && hasCustomUserImage) ? customUserImageUrl : null,
        customUserImageNotes: (isCustomDesignActive && hasCustomUserImage) ? customUserImageNotes : null,
        customImageFee: (isCustomDesignActive && hasCustomUserImage) ? 5.00 : 0,
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
        product: {
          title: selectedProduct.title,
          quantity,
          selectedOption,
          designTitle: isCustomDesignActive ? selectedDesign?.title : null
        },
        customDesignVariation: isCustomDesignActive ? selectedDesign?.title : null,
        hasCustomUserImage: Boolean(isCustomDesignActive && hasCustomUserImage),
        customUserImageUrl: (isCustomDesignActive && hasCustomUserImage) ? customUserImageUrl : null,
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

              {isApparelCustomizable(product) && (
                <div className="absolute top-4 right-4 bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 border border-pink-400/30">
                  <Sparkles className="w-3 h-3" /> Custom Designs
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                {product.isPoa || product.price === 0 ? (
                  <span className="bg-amber-500 text-black font-black text-xs md:text-sm px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> POA / Custom Quote
                  </span>
                ) : (
                  <span className="bg-lime-500 text-black font-black text-base md:text-lg px-3 py-1 rounded-xl shadow-xl">
                    £{Number(product.price).toFixed(2)}
                  </span>
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-md border ${
                  product.inStock !== false 
                    ? (product.isPoa || product.price === 0 ? 'bg-amber-950/80 text-amber-400 border-amber-500/30' : 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30')
                    : 'bg-rose-950/80 text-rose-400 border-rose-500/30'
                }`}>
                  {product.inStock !== false ? ((product.isPoa || product.price === 0) ? 'Custom Order' : 'In Stock') : 'Sold Out'}
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

              {isApparelCustomizable(product) ? (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => openOrderModal(product, false)}
                    disabled={product.inStock === false}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-xl uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-600 disabled:opacity-40"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-lime-400" />
                    Standard Club Edition
                  </button>
                  <button
                    onClick={() => openOrderModal(product, true)}
                    disabled={product.inStock === false}
                    className="w-full bg-gradient-to-r from-lime-500 via-emerald-400 to-lime-500 hover:from-lime-400 hover:to-emerald-300 text-black font-black py-3 rounded-xl uppercase tracking-wider text-xs transition-all shadow-lg shadow-lime-500/20 active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <Sparkles className="w-4 h-4" />
                    Purchase a Custom Design
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openOrderModal(product)}
                  disabled={product.inStock === false}
                  className={`w-full font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                    product.inStock === false
                      ? 'bg-zinc-800 text-zinc-500 opacity-40 cursor-not-allowed'
                      : (product.isPoa || product.price === 0)
                        ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 active:scale-[0.99]'
                        : 'bg-zinc-800 hover:bg-lime-500 text-white hover:text-black group-hover:shadow-lime-500/20 active:scale-[0.99]'
                  }`}
                >
                  {(product.isPoa || product.price === 0) ? (
                    <><Sparkles className="w-4 h-4" /> Request Quote / Custom Specs (POA)</>
                  ) : (
                    <><ShoppingBag className="w-4 h-4" /> {product.inStock !== false ? 'Order / Buy Now' : 'Currently Sold Out'}</>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order Modal with SumUp Checkout */}
      {selectedProduct && (
        <div
          id="order-modal-backdrop"
          onClick={(e) => {
            if (e.target.id === 'order-modal-backdrop') {
              closeOrderModal();
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex justify-center items-start p-3 sm:p-6 md:p-8 overscroll-contain animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-8 shadow-2xl my-3 sm:my-6 flex flex-col"
          >
            {/* Sticky Floating Exit Bar - ALWAYS visible regardless of scroll position */}
            <div className="sticky top-0 -mt-2 -mr-2 sm:-mt-4 sm:-mr-4 pt-1 pr-1 flex justify-end z-30 pointer-events-none mb-1">
              <button
                type="button"
                onClick={closeOrderModal}
                className="pointer-events-auto p-2 sm:p-2.5 rounded-2xl bg-zinc-900/95 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 shadow-xl transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer"
                title="Exit (Esc or Click outside)"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 text-zinc-300" />
                <span className="text-[11px] uppercase tracking-wider font-extrabold pr-0.5">Exit</span>
              </button>
            </div>

            {completedOrder ? (
              /* Order Completed Screen */
              completedOrder.isPoa ? (
                <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-xl">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      Custom Quote Request Received
                    </span>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic mt-3">
                      Quote Request Submitted!
                    </h2>
                    <p className="text-zinc-400 text-xs md:text-sm mt-1">
                      Quote Reference: <span className="font-mono text-amber-400 font-bold">{completedOrder.orderNumber}</span>
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
                    {completedOrder.customDesignNotes && (
                      <div className="border-b border-zinc-800 pb-3">
                        <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold block mb-1">Your Custom Specifications:</span>
                        <p className="text-zinc-200 text-xs bg-black/60 p-3 rounded-xl border border-zinc-800 font-mono whitespace-pre-wrap">
                          {completedOrder.customDesignNotes}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                      <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Fulfillment:</span>
                      <span className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        {completedOrder.fulfillmentType === 'meet_pickup' ? (
                          <><MapPin className="w-3.5 h-3.5" /> Collection at DRS Meet</>
                        ) : (
                          <><Truck className="w-3.5 h-3.5" /> UK Postal Delivery</>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Pricing:</span>
                      <span className="text-amber-400 font-black text-base">
                        Price on Application (POA)
                      </span>
                    </div>
                  </div>

                  <p className="text-zinc-400 text-xs leading-relaxed max-w-md mx-auto">
                    Thank you <span className="text-white font-bold">{completedOrder.customerName}</span>! Our team has received your custom design specifications and will contact you at <span className="text-amber-400 font-bold">{completedOrder.customerEmail}</span> with a design proof and direct quote.
                  </p>

                  <button
                    onClick={closeOrderModal}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black px-8 py-3.5 rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-amber-500/20"
                  >
                    Done
                  </button>
                </div>
              ) : (
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
                    {completedOrder.customDesignVariation && (
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                        <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Design Artwork:</span>
                        <span className="text-lime-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> {completedOrder.customDesignVariation}
                        </span>
                      </div>
                    )}
                    {completedOrder.hasCustomUserImage && (
                      <div className="border-b border-zinc-800 pb-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 text-xs uppercase tracking-wider font-bold">Customer Photo Add-on:</span>
                          <span className="text-lime-400 font-bold text-xs flex items-center gap-1 font-mono">
                            +£5.00 Included
                          </span>
                        </div>
                        {completedOrder.customUserImageUrl && (
                          <div className="flex items-center gap-3 bg-black/60 p-2.5 rounded-xl border border-zinc-800">
                            <img
                              src={completedOrder.customUserImageUrl}
                              alt="Your uploaded design"
                              className="w-12 h-12 rounded-lg object-cover border border-zinc-700 shrink-0"
                            />
                            <div className="text-xs text-zinc-400 min-w-0">
                              <p className="text-white font-semibold truncate">Uploaded Image Attached</p>
                              <p className="text-[11px] text-zinc-500">Will be integrated into the print design</p>
                            </div>
                          </div>
                        )}
                        {completedOrder.customUserImageNotes && (
                          <p className="text-[11px] text-zinc-400 italic">
                            Placement: &quot;{completedOrder.customUserImageNotes}&quot;
                          </p>
                        )}
                      </div>
                    )}
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
              )
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
                    Cancel &amp; Exit
                  </button>
                </div>
              </div>
            ) : (
              /* Order Details & Sizing Form */
              <form onSubmit={handleStartCheckout} className="space-y-6">
                <div className="flex gap-4 items-start border-b border-zinc-800 pb-5">
                  <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0">
                    <img
                      src={isCustomDesignActive && selectedDesign ? selectedDesign.image : selectedProduct.image}
                      alt={selectedProduct.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full rounded-2xl object-cover border border-zinc-800"
                    />
                    {isCustomDesignActive && (
                      <span className="absolute -bottom-1.5 -right-1 bg-gradient-to-r from-pink-500 to-lime-400 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                      {selectedProduct.category}
                    </span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight truncate">
                      {selectedProduct.title}
                    </h3>
                    {isCustomDesignActive && selectedDesign && (
                      <p className="text-xs text-lime-400 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        <span>Artwork: <strong className="text-white font-mono">{selectedDesign.title}</strong></span>
                      </p>
                    )}
                    {isSelectedProductPoa ? (
                      <p className="text-amber-400 font-black text-base flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Price on Application (POA)
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                        <p className="text-lime-400 font-black text-lg">
                          £{effectiveUnitPrice.toFixed(2)}
                        </p>
                        {isCustomDesignActive && hasCustomUserImage && (
                          <span className="text-[10px] text-zinc-400 font-medium">
                            (Includes £5 custom image)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Garment Design Edition Switcher (Standard vs Custom Gallery) */}
                {isApparel && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Print &amp; Graphic Edition:
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/60 rounded-2xl border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setDesignMode('standard')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          designMode === 'standard'
                            ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Official Club Print
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesignMode('custom')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          designMode === 'custom'
                            ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-lime-500 text-black shadow-lg font-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Custom Gallery ({galleryDesigns.length})
                      </button>
                    </div>
                  </div>
                )}

                {/* Preloaded Gallery of Designs + Custom Photo Option */}
                {isCustomDesignActive && (
                  <div className="space-y-4 bg-black/40 p-4 rounded-2xl border border-zinc-800/80 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-lime-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-pink-400" /> Choose Design from Gallery:
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {galleryDesigns.length} Variations
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1 pr-2">
                      {galleryDesigns.map((des) => (
                        <button
                          key={des.id}
                          type="button"
                          onClick={() => setSelectedDesign(des)}
                          className={`group relative rounded-2xl overflow-hidden border p-2 text-left transition-all flex flex-col ${
                            selectedDesign?.id === des.id
                              ? 'bg-lime-500/10 border-lime-400 ring-2 ring-lime-400/50 shadow-lg shadow-lime-500/10'
                              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black mb-1.5 flex items-center justify-center">
                            <img
                              src={des.image}
                              alt={des.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {selectedDesign?.id === des.id && (
                              <div className="absolute top-1.5 right-1.5 bg-lime-500 text-black p-1 rounded-full shadow-md">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {des.tag && (
                              <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-lime-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                                {des.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-white font-bold text-[11px] line-clamp-1 leading-tight">{des.title}</p>
                          <p className="text-zinc-500 text-[9px] uppercase font-semibold mt-0.5">{des.category}</p>
                        </button>
                      ))}
                    </div>

                    {selectedDesign && (
                      <div className="p-3 bg-zinc-900/90 rounded-2xl border border-zinc-800/80 flex items-center gap-3">
                        <img src={selectedDesign.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-zinc-800 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-lime-400 text-[10px] font-bold uppercase tracking-wider">Active Print Variation</p>
                          <p className="text-white font-black text-xs truncate">{selectedDesign.title}</p>
                          <p className="text-zinc-400 text-[11px] line-clamp-1">{selectedDesign.description}</p>
                        </div>
                      </div>
                    )}

                    {/* Custom Image Upload Option (+£5 Extra) */}
                    <div className={`p-3.5 rounded-2xl border transition-all ${
                      hasCustomUserImage ? 'bg-lime-500/10 border-lime-500/50' : 'bg-zinc-900/90 border-zinc-800'
                    }`}>
                      <div
                        className="flex items-start justify-between gap-3 cursor-pointer select-none"
                        onClick={() => {
                          const next = !hasCustomUserImage;
                          setHasCustomUserImage(next);
                          if (!next) setUserImageUploadError('');
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            hasCustomUserImage ? 'bg-lime-500 text-black font-black' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-white text-xs font-black uppercase tracking-wider">
                                Provide your own image to be put into the design
                              </span>
                              <span className="bg-lime-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                +£5.00 Extra
                              </span>
                            </div>
                            <p className="text-zinc-400 text-[11px] mt-1 leading-relaxed">
                              Add your car photo, engine bay shot, custom logo or graphic to be printed into your chosen garment design.
                            </p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={hasCustomUserImage}
                          onChange={(e) => {
                            setHasCustomUserImage(e.target.checked);
                            if (!e.target.checked) setUserImageUploadError('');
                          }}
                          className="w-5 h-5 accent-lime-500 rounded cursor-pointer shrink-0 mt-0.5"
                        />
                      </div>

                      {hasCustomUserImage && (
                        <div className="mt-3.5 pt-3 border-t border-zinc-800/80 space-y-3 animate-in fade-in duration-300">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5 text-lime-400" /> Upload Your Image / Photo:
                            </label>
                            {customUserImageUrl && (
                              <span className="text-[10px] text-lime-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Image Ready
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 items-start">
                            {customUserImageUrl ? (
                              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-lime-500/50 shrink-0 bg-black shadow-lg">
                                <img
                                  src={customUserImageUrl}
                                  alt="Custom upload"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCustomUserImageUrl('')}
                                  className="absolute top-1 right-1 p-1 rounded-lg bg-black/80 text-rose-400 hover:text-rose-300 transition-colors"
                                  title="Remove Photo"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center text-zinc-500 shrink-0 bg-black/50">
                                <Camera className="w-5 h-5 mb-1 text-zinc-500" />
                                <span className="text-[9px] uppercase font-bold text-zinc-500">Add Photo</span>
                              </div>
                            )}

                            <div className="flex-1 space-y-2 w-full">
                              <input
                                type="file"
                                ref={userImageFileInputRef}
                                onChange={handleCustomerImageUpload}
                                accept="image/*"
                                className="hidden"
                              />

                              <button
                                type="button"
                                disabled={isUploadingUserImage}
                                onClick={() => userImageFileInputRef.current?.click()}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                              >
                                {isUploadingUserImage ? (
                                  <><RefreshCw className="w-3.5 h-3.5 animate-spin text-lime-400" /> Uploading {userImageUploadProgress}%...</>
                                ) : (
                                  <><Upload className="w-3.5 h-3.5 text-lime-400" /> Choose Photo from Device</>
                                )}
                              </button>

                              {userImageUploadError && (
                                <p className="text-[11px] text-rose-400 font-medium">{userImageUploadError}</p>
                              )}

                              <input
                                type="text"
                                value={customUserImageUrl}
                                onChange={(e) => setCustomUserImageUrl(e.target.value)}
                                placeholder="Or paste direct image URL (https://...)"
                                className="w-full bg-black border border-zinc-800 text-white rounded-xl p-2.5 text-xs focus:border-lime-500 outline-none font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                              Design Placement / Instructions (Optional)
                            </label>
                            <input
                              type="text"
                              value={customUserImageNotes}
                              onChange={(e) => setCustomUserImageNotes(e.target.value)}
                              placeholder="e.g. Put my car in the center frame, small DRS crest on chest"
                              className="w-full bg-black border border-zinc-800 text-white rounded-xl p-2.5 text-xs focus:border-lime-500 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                {/* Custom Design Notes Input for POA / Made to Order */}
                {isSelectedProductPoa && (
                  <div className="space-y-2 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Custom Design Specifications
                      </label>
                      <span className="text-[10px] bg-amber-500 text-black font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Required for Quote
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Please describe your custom design requirements (e.g. text for laser engraving on keyrings, bookmarks or dog tags, pet name & phone numbers, or custom vinyl sign dimensions, fonts & artwork details):
                    </p>
                    <textarea
                      rows={3}
                      required
                      value={customDesignNotes}
                      onChange={(e) => setCustomDesignNotes(e.target.value)}
                      placeholder="e.g. Stainless dog tag with 'LOKI' on front, '07123 456789' on back / Custom windscreen banner text 'DAILY RIDE' in holographic vinyl..."
                      className="w-full bg-black border border-zinc-800 focus:border-amber-500 text-white rounded-xl p-3 text-xs outline-none leading-relaxed"
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
                {isSelectedProductPoa ? (
                  <div className="border-t border-zinc-800 pt-4 space-y-3">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Pricing Structure:</span>
                      <span className="font-mono text-amber-400 font-bold">Price on Application (POA)</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Fulfillment Preference:</span>
                      <span className="font-mono text-white">
                        {fulfillmentType === 'meet_pickup' ? 'Collection at DRS Meet (Free)' : 'UK Postal Delivery (+£3.99 quote)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-base font-black text-white pt-2 border-t border-zinc-800/60">
                      <span>Due Today:</span>
                      <span className="text-amber-400 text-xl font-mono">
                        £0.00 (Direct Quote)
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeOrderModal}
                        className="px-5 py-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-wider text-xs transition-colors"
                      >
                        Exit
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs shadow-xl shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting Custom Quote...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" /> Submit Custom Design Request (POA)</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-zinc-800 pt-4 space-y-3">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Base Garment ({selectedProduct.title} x{quantity}):</span>
                      <span className="font-mono">£{(selectedProduct.price * quantity).toFixed(2)}</span>
                    </div>
                    {isCustomDesignActive && (
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Selected Artwork ({selectedDesign?.title || 'Custom'}):</span>
                        <span className="font-mono text-lime-400 font-bold">Included</span>
                      </div>
                    )}
                    {isCustomDesignActive && hasCustomUserImage && (
                      <div className="flex justify-between text-xs text-lime-400 font-semibold bg-lime-500/10 p-2 rounded-lg border border-lime-500/20">
                        <span>Customer Photo Integration (+£5.00 x{quantity}):</span>
                        <span className="font-mono font-bold">+£{(5 * quantity).toFixed(2)}</span>
                      </div>
                    )}
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

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeOrderModal}
                        className="px-5 py-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-wider text-xs transition-colors"
                      >
                        Exit
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest text-xs shadow-xl shadow-lime-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Preparing Checkout...</>
                        ) : (
                          <><ShoppingBag className="w-4 h-4" /> Pay £{grandTotal.toFixed(2)} via SumUp</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
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

  // Gallery Designs Management State
  const [galleryDesigns, setGalleryDesigns] = useState(DEFAULT_GALLERY_DESIGNS);
  const [editingDesign, setEditingDesign] = useState(null);
  const [isCreatingDesign, setIsCreatingDesign] = useState(false);
  const [designForm, setDesignForm] = useState({
    title: '',
    category: 'Custom Graphics',
    image: '/merch/designs/neon-drift.svg',
    tag: ''
  });
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [designSaveError, setDesignSaveError] = useState('');
  const [designSaveSuccess, setDesignSaveSuccess] = useState('');
  const [designImageUploading, setDesignImageUploading] = useState(false);
  const [designImageProgress, setDesignImageProgress] = useState(0);
  const [designImageError, setDesignImageError] = useState('');
  const designFileInputRef = useRef(null);

  // Bulk Design Upload State
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkQueue, setBulkQueue] = useState([]); // [{ id, file, preview, title }]
  const [bulkCategory, setBulkCategory] = useState('Custom Graphics');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  const bulkFileInputRef = useRef(null);

  // Escape key handler for admin modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isBulkUploading && !isProcessingBulk) setIsBulkUploading(false);
        if (isCreatingDesign && !isSavingDesign) { setIsCreatingDesign(false); setEditingDesign(null); }
        if (isCreatingProduct && !isSavingProduct) { setIsCreatingProduct(false); setEditingProduct(null); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBulkUploading, isProcessingBulk, isCreatingDesign, isSavingDesign, isCreatingProduct, isSavingProduct]);
  
  // Product edit / create modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    category: 'Laser Engraving',
    price: 0,
    isPoa: false,
    poaLabel: 'POA / Custom Quote',
    supportsCustomDesign: false,
    description: '',
    image: '',
    optionsLabel: 'Options',
    optionsText: '',
    inStock: true,
    tag: ''
  });

  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Image Upload State
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Auth context
  const currentUser = auth?.currentUser;

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

  // Sync Designs from Firestore
  useEffect(() => {
    if (!db || !appId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'merch_designs'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const customIds = new Set(list.map(d => d.id));
          const combined = [...list, ...DEFAULT_GALLERY_DESIGNS.filter(d => !customIds.has(d.id))];
          setGalleryDesigns(combined);
        }
      },
      (err) => console.error("Error fetching admin merch designs:", err)
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

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      setImageUploadError("Storage service is not connected. You can enter an image URL directly.");
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageUploadError("Please select a valid image file (PNG, JPG, WEBP, SVG).");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setImageUploadError("Image size must be under 12MB.");
      return;
    }

    setImageUploading(true);
    setImageUploadProgress(0);
    setImageUploadError('');

    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uploaderId = currentUser?.uid || 'admin';
      const storagePath = `artifacts/${appId || 'daily-ride-south'}/merch/${uploaderId}_${Date.now()}_${cleanFileName}`;
      const fileRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setImageUploadProgress(Math.round(progress));
        },
        (err) => {
          console.error("Image upload failed:", err);
          setImageUploadError(err.message || "Failed to upload image.");
          setImageUploading(false);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            setProductForm(prev => ({ ...prev, image: downloadUrl }));
            setImageUploading(false);
            setImageUploadProgress(0);
          } catch (urlErr) {
            console.error("Error retrieving download URL:", urlErr);
            setImageUploadError("Image uploaded but failed to retrieve public URL.");
            setImageUploading(false);
          }
        }
      );
    } catch (err) {
      console.error("Upload error:", err);
      setImageUploadError(err.message || "Could not process image upload.");
      setImageUploading(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');

    if (!productForm.title || !productForm.title.trim()) {
      setSaveError("Please enter a product title.");
      return;
    }

    const isPoa = Boolean(productForm.isPoa);
    if (!isPoa) {
      const numericPrice = parseFloat(productForm.price);
      if (isNaN(numericPrice) || numericPrice < 0) {
        setSaveError("Please enter a valid price (or enable 'Price on Application (POA)' for custom quotes).");
        return;
      }
    }

    if (!db || !appId) {
      setSaveError("Database connection is not available. Please refresh the page.");
      return;
    }

    setIsSavingProduct(true);

    const parsedOptions = productForm.optionsText
      ? productForm.optionsText.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const targetId = editingProduct?.id || `drs-merch-${Date.now()}`;

    const productPayload = {
      id: targetId,
      title: productForm.title.trim(),
      category: productForm.category,
      price: isPoa ? 0 : Number(parseFloat(productForm.price).toFixed(2)),
      isPoa: isPoa,
      poaLabel: productForm.poaLabel || 'POA / Custom Quote',
      supportsCustomDesign: Boolean(productForm.supportsCustomDesign),
      description: (productForm.description || '').trim(),
      image: productForm.image || '/merch/laser-engraving.svg',
      optionsLabel: (productForm.optionsLabel || 'Options').trim(),
      options: parsedOptions,
      inStock: Boolean(productForm.inStock),
      tag: (productForm.tag || '').trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'merch_products', targetId),
        productPayload,
        { merge: true }
      );

      // Optimistically update local state immediately
      setProducts(prev => {
        const idx = prev.findIndex(p => p.id === targetId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = productPayload;
          return updated;
        }
        return [productPayload, ...prev];
      });

      setSaveSuccess("Product saved successfully!");
      setTimeout(() => {
        setIsCreatingProduct(false);
        setEditingProduct(null);
        setSaveSuccess('');
      }, 500);
    } catch (err) {
      console.error("Failed to save product:", err);
      setSaveError("Failed to save product: " + (err.message || 'Unknown database error'));
    } finally {
      setIsSavingProduct(false);
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

  const handleDesignImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setDesignImageError("Please select a valid image file (PNG, JPG, WEBP, SVG).");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setDesignImageError("Image size must be under 12MB.");
      return;
    }

    setDesignImageUploading(true);
    setDesignImageProgress(0);
    setDesignImageError('');

    try {
      if (storage) {
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `merch/designs/${Date.now()}_${cleanFileName}`;
        const imageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(imageRef, file);

        uploadTask.on(
          'state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setDesignImageProgress(pct);
          },
          (err) => {
            console.warn("Storage upload failed, fallback to DataURL:", err);
            const reader = new FileReader();
            reader.onload = () => {
              setDesignForm(prev => ({ ...prev, image: reader.result }));
              setDesignImageUploading(false);
            };
            reader.readAsDataURL(file);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setDesignForm(prev => ({ ...prev, image: downloadUrl }));
              setDesignImageUploading(false);
              setDesignImageProgress(0);
            } catch (urlErr) {
              console.error("Error retrieving download URL:", urlErr);
              const reader = new FileReader();
              reader.onload = () => {
                setDesignForm(prev => ({ ...prev, image: reader.result }));
                setDesignImageUploading(false);
              };
              reader.readAsDataURL(file);
            }
          }
        );
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setDesignForm(prev => ({ ...prev, image: reader.result }));
          setDesignImageUploading(false);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setDesignImageError(err.message || "Could not process image upload.");
      setDesignImageUploading(false);
    }
  };

  const handleSaveDesign = async (e) => {
    e.preventDefault();
    setDesignSaveError('');
    setDesignSaveSuccess('');

    if (!designForm.title || !designForm.title.trim()) {
      setDesignSaveError("Please enter a design title.");
      return;
    }

    if (!db || !appId) {
      setDesignSaveError("Database connection is not available.");
      return;
    }

    setIsSavingDesign(true);
    const targetId = editingDesign?.id || `drs-design-${Date.now()}`;

    // Leave out description as requested, only store title, category, badge, image
    const designPayload = {
      id: targetId,
      title: designForm.title.trim(),
      category: designForm.category || 'Custom Graphics',
      image: designForm.image || '/merch/designs/neon-drift.svg',
      tag: (designForm.tag || '').trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'merch_designs', targetId),
        designPayload,
        { merge: true }
      );

      setGalleryDesigns(prev => {
        const idx = prev.findIndex(d => d.id === targetId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = designPayload;
          return updated;
        }
        return [designPayload, ...prev];
      });

      setDesignSaveSuccess("Gallery design saved successfully!");
      setTimeout(() => {
        setIsCreatingDesign(false);
        setEditingDesign(null);
        setDesignSaveSuccess('');
      }, 500);
    } catch (err) {
      console.error("Failed to save design:", err);
      setDesignSaveError("Failed to save design: " + (err.message || 'Unknown database error'));
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleDeleteDesign = async (designId) => {
    if (!window.confirm("Are you sure you want to delete this custom design variation from the gallery?")) return;
    try {
      if (db && appId) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_designs', designId));
      }
      setGalleryDesigns(prev => prev.filter(d => d.id !== designId));
    } catch (err) {
      console.error("Failed to delete design:", err);
      alert("Error deleting design: " + err.message);
    }
  };

  // Convert raw filename to clean display title (e.g. "kanjo_drift_spec.png" -> "Kanjo Drift Spec")
  const formatTitleFromFileName = (fileName) => {
    if (!fileName) return 'Custom Design';
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const cleanWords = nameWithoutExt.replace(/[_-]+/g, " ").trim();
    return cleanWords
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "Custom Design";
  };

  // Handle multi-file selection for bulk design uploads
  const handleBulkFilesSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setBulkError('');
    setBulkSuccess('');

    const newItems = files.map((file, idx) => {
      const id = `bulk-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const title = formatTitleFromFileName(file.name);
      let preview;
      try {
        preview = URL.createObjectURL(file);
      } catch {
        preview = '';
      }
      return {
        id,
        file,
        preview,
        title
      };
    });

    setBulkQueue(prev => [...prev, ...newItems]);
    if (e.target) e.target.value = '';
  };

  const handleUpdateBulkTitle = (id, newTitle) => {
    setBulkQueue(prev => prev.map(item => item.id === id ? { ...item, title: newTitle } : item));
  };

  const handleRemoveBulkItem = (id) => {
    setBulkQueue(prev => prev.filter(item => item.id !== id));
  };

  // Upload and persist all queued design variations (with titles only, omitting descriptions)
  const handleProcessBulkUpload = async () => {
    if (!bulkQueue.length) {
      setBulkError("Please select at least one design image to upload.");
      return;
    }

    if (!db || !appId) {
      setBulkError("Database connection is not available.");
      return;
    }

    setIsProcessingBulk(true);
    setBulkError('');
    setBulkSuccess('');
    setBulkProgress(0);

    const savedDesigns = [];
    let completedCount = 0;

    for (let i = 0; i < bulkQueue.length; i++) {
      const item = bulkQueue[i];
      const designId = `drs-design-${Date.now()}-${i}`;
      const title = (item.title && item.title.trim()) || formatTitleFromFileName(item.file.name);

      try {
        let imageUrl = '';
        if (storage) {
          try {
            const cleanFileName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `merch/designs/${Date.now()}_${i}_${cleanFileName}`;
            const imageRef = ref(storage, storagePath);
            const uploadRes = await uploadBytesResumable(imageRef, item.file);
            imageUrl = await getDownloadURL(uploadRes.ref);
          } catch (storageErr) {
            console.warn("Storage upload failed, falling back to dataURL:", storageErr);
            imageUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => resolve('/merch/designs/neon-drift.svg');
              reader.readAsDataURL(item.file);
            });
          }
        } else {
          imageUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('/merch/designs/neon-drift.svg');
            reader.readAsDataURL(item.file);
          });
        }

        // Schema leaves out description, just includes title, category, and image
        const payload = {
          id: designId,
          title: title,
          category: bulkCategory || 'Custom Graphics',
          image: imageUrl,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        await setDoc(
          doc(db, 'artifacts', appId, 'public', 'data', 'merch_designs', designId),
          payload,
          { merge: true }
        );

        savedDesigns.push(payload);
        completedCount++;
        setBulkProgress(completedCount);
      } catch (err) {
        console.error(`Error saving design variation ${item.title}:`, err);
      }
    }

    setGalleryDesigns(prev => [...savedDesigns, ...prev]);
    setIsProcessingBulk(false);
    setBulkSuccess(`Successfully uploaded and added ${completedCount} design variations!`);

    setTimeout(() => {
      setIsBulkUploading(false);
      setBulkQueue([]);
      setBulkSuccess('');
      setBulkProgress(0);
    }, 1200);
  };

  const handleSeedDefaultDesigns = async () => {
    if (!db || !appId) return;
    if (!window.confirm("Restore the 5 official preloaded gallery designs (Neon Drift, Kanjo Night, Turbo Blueprint, Midnight Horizon, Retro Tachometer)?")) return;
    try {
      for (const d of DEFAULT_GALLERY_DESIGNS) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'merch_designs', d.id), d);
      }
      setGalleryDesigns(DEFAULT_GALLERY_DESIGNS);
      alert("Preloaded gallery designs restored successfully!");
    } catch (err) {
      console.error("Failed to restore default designs:", err);
      alert("Failed to restore designs: " + err.message);
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

          <button
            type="button"
            onClick={() => setActiveTab('designs')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'designs'
                ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-lime-400 text-black shadow-md font-black'
                : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Design Gallery ({galleryDesigns.length})
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
                  isPoa: false,
                  poaLabel: 'POA / Custom Quote',
                  supportsCustomDesign: false,
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

        {activeTab === 'designs' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSeedDefaultDesigns}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-zinc-700"
            >
              Restore 5 Defaults
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkQueue([]);
                setBulkError('');
                setBulkSuccess('');
                setBulkProgress(0);
                setIsBulkUploading(true);
              }}
              className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-black px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" /> Bulk Upload Designs
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingDesign(null);
                setDesignForm({
                  title: '',
                  category: 'Custom Graphics',
                  image: '/merch/designs/neon-drift.svg',
                  tag: ''
                });
                setDesignSaveError('');
                setDesignSaveSuccess('');
                setDesignImageError('');
                setIsCreatingDesign(true);
              }}
              className="bg-lime-500 hover:bg-lime-400 text-black font-black px-3.5 py-2 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Single Design
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
                      {(order.isPoa || order.paymentStatus === 'POA_INQUIRY') && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500 text-black flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Custom Quote
                        </span>
                      )}
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        order.fulfillmentStatus === 'Pending' || order.fulfillmentStatus === 'Quote Pending'
                          ? 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                          : order.fulfillmentStatus === 'Quote Sent'
                          ? 'bg-cyan-950/80 text-cyan-400 border-cyan-500/40'
                          : order.fulfillmentStatus === 'In Production'
                          ? 'bg-purple-950/80 text-purple-400 border-purple-500/40'
                          : order.fulfillmentStatus === 'Dispatched'
                          ? 'bg-blue-950/80 text-blue-400 border-blue-500/40'
                          : 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                      }`}>
                        {order.fulfillmentStatus || 'Pending'}
                      </span>
                      <span className="text-zinc-400 font-mono text-xs font-black">
                        {order.isPoa ? 'POA' : `£${Number(order.grandTotal).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {order.customDesignNotes && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs space-y-1">
                      <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Customer Specifications / Design Notes:
                      </span>
                      <p className="text-zinc-200 font-mono whitespace-pre-wrap leading-relaxed text-xs">
                        {order.customDesignNotes}
                      </p>
                    </div>
                  )}

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
                      {order.customDesignVariation && (
                        <p className="text-lime-400 font-bold text-[11px] flex items-center gap-1 mt-1">
                          <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                          <span>Artwork: <span className="text-white">{order.customDesignVariation}</span></span>
                        </p>
                      )}
                      {order.hasCustomUserImage && (
                        <div className="pt-1 space-y-1">
                          <span className="inline-block bg-lime-500/20 text-lime-400 border border-lime-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                            +£5 Custom Photo Attached
                          </span>
                          {order.customUserImageUrl && (
                            <a
                              href={order.customUserImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 bg-black/60 p-1.5 rounded-lg border border-zinc-800 hover:border-lime-500 transition-colors group"
                            >
                              <img
                                src={order.customUserImageUrl}
                                alt="Customer upload"
                                className="w-9 h-9 rounded object-cover border border-zinc-700 shrink-0"
                              />
                              <div className="text-[10px] min-w-0">
                                <p className="text-lime-400 font-bold group-hover:underline flex items-center gap-1">
                                  View / Download Photo
                                </p>
                                <p className="text-zinc-500 text-[9px]">Click to inspect customer image</p>
                              </div>
                            </a>
                          )}
                          {order.customUserImageNotes && (
                            <p className="text-[10px] text-zinc-400 italic">
                              Note: &quot;{order.customUserImageNotes}&quot;
                            </p>
                          )}
                        </div>
                      )}
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
                      Ref: {order.orderNumber || order.id} • {order.paymentStatus || 'Verified'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {order.fulfillmentStatus !== 'Quote Sent' && (order.isPoa || order.paymentStatus === 'POA_INQUIRY') && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Quote Sent')}
                          className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Mark Quote Sent
                        </button>
                      )}
                      {order.fulfillmentStatus !== 'In Production' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'In Production')}
                          className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          In Production
                        </button>
                      )}
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
                      {order.fulfillmentStatus !== 'Pending' && order.fulfillmentStatus !== 'Quote Pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, order.isPoa ? 'Quote Pending' : 'Pending')}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          Reset Status
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
                    {p.isPoa || Number(p.price) === 0 ? (
                      <p className="text-amber-400 font-mono font-bold text-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> POA / Quote
                      </p>
                    ) : (
                      <p className="text-lime-400 font-mono font-bold text-xs">
                        £{Number(p.price).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/60 pt-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      p.inStock !== false ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {p.inStock !== false ? 'In Stock' : 'Sold Out'}
                    </span>
                    {(p.isPoa || Number(p.price) === 0) && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        POA
                      </span>
                    )}
                    {Boolean(p.supportsCustomDesign) && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        Designs
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(p);
                        setProductForm({
                          title: p.title,
                          category: p.category || 'Laser Engraving',
                          price: p.price ?? 0,
                          isPoa: Boolean(p.isPoa || Number(p.price) === 0),
                          poaLabel: p.poaLabel || 'POA / Custom Quote',
                          supportsCustomDesign: Boolean(p.supportsCustomDesign),
                          description: p.description || '',
                          image: p.image || '',
                          optionsLabel: p.optionsLabel || 'Options',
                          optionsText: (p.options || []).join(', '),
                          inStock: p.inStock !== false,
                          tag: p.tag || ''
                        });
                        setSaveError('');
                        setSaveSuccess('');
                        setImageUploadError('');
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

      {/* --- TAB CONTENT: DESIGNS GALLERY --- */}
      {activeTab === 'designs' && (
        <div className="space-y-4">
          <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" /> Preloaded Custom Designs Gallery
              </h4>
              <p className="text-zinc-400 text-xs mt-0.5">
                These graphic variations appear when customers choose &ldquo;Purchase a Custom Design&rdquo; on hoodies or t-shirts. Customers can also provide their own image for +£5.
              </p>
            </div>
            <div className="text-xs text-lime-400 font-mono font-bold bg-lime-500/10 px-3 py-1.5 rounded-xl border border-lime-500/20 whitespace-nowrap">
              {galleryDesigns.length} Active Variations
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryDesigns.map((des) => (
              <div
                key={des.id}
                className="bg-black/60 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col justify-between p-4 space-y-3"
              >
                <div className="flex gap-3">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black border border-zinc-800 shrink-0">
                    <img
                      src={des.image}
                      alt={des.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    {des.tag && (
                      <span className="absolute bottom-1 left-1 bg-black/80 text-lime-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                        {des.tag}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 overflow-hidden flex-1 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block">
                      {des.category || 'Custom Graphics'}
                    </span>
                    <h4 className="text-white font-black text-sm truncate">{des.title}</h4>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/60 pt-2">
                  <span className="text-[10px] text-lime-400 font-mono">
                    ID: {des.id}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDesign(des);
                        setDesignForm({
                          title: des.title,
                          category: des.category || 'Custom Graphics',
                          image: des.image || '',
                          tag: des.tag || ''
                        });
                        setDesignSaveError('');
                        setDesignSaveSuccess('');
                        setDesignImageError('');
                        setIsCreatingDesign(true);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Edit Design"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDesign(des.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-rose-400 hover:text-rose-300 transition-colors"
                      title="Delete Design"
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
        <div
          id="product-modal-backdrop"
          onClick={(e) => {
            if (e.target.id === 'product-modal-backdrop') {
              setIsCreatingProduct(false);
              setEditingProduct(null);
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex justify-center items-start p-3 sm:p-6 overscroll-contain animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl my-4 sm:my-8"
          >
            <button
              type="button"
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
                  placeholder="e.g. DRS Custom Laser Engraving or Vinyl Sunstrip"
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              {/* Category & POA Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    {productForm.isPoa ? 'Price Structure' : 'Price (£ GBP)'}
                  </label>
                  {productForm.isPoa ? (
                    <div className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-3 text-sm font-bold flex items-center justify-between">
                      <span>POA / Quote</span>
                      <span className="text-[10px] uppercase tracking-wider font-normal text-amber-400/80">No fixed price</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      value={productForm.price}
                      onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                      placeholder="e.g. 25.00"
                      className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                    />
                  )}
                </div>
              </div>

              {/* POA / Made to Order Switch */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Price on Application (POA)
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.isPoa}
                      onChange={(e) => setProductForm({ ...productForm, isPoa: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Enable for bespoke items (laser engraving on keyrings, bookmarks, dog tags, or custom vinyl signs made to customer specs). Customers submit requirements and receive a quote instead of an immediate charge.
                </p>
              </div>

              {/* Custom Design Variations Switch */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Custom Design Variations &amp; Photo Upload
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productForm.supportsCustomDesign}
                      onChange={(e) => setProductForm({ ...productForm, supportsCustomDesign: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                  </label>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Enable for apparel (e.g. Hoodies, T-Shirts). Customers can select preloaded gallery graphics and have the option to provide their own photo/artwork for +£5.
                </p>
              </div>

              {/* Merch Image Upload & Asset Picker */}
              <div className="space-y-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-lime-400" /> Product Image
                  </label>
                  {productForm.image && (
                    <span className="text-[10px] text-lime-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Image Selected
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {productForm.image ? (
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-zinc-700 shrink-0 bg-black">
                      <img
                        src={productForm.image}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, image: '' })}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/80 text-rose-400 hover:text-rose-300 transition-colors"
                        title="Remove Image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-500 shrink-0 bg-zinc-950">
                      <ImageIcon className="w-6 h-6 mb-1 text-zinc-600" />
                      <span className="text-[9px] uppercase font-bold text-zinc-500">No Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2 w-full">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Upload from device button or custom ImageUploadComponent */}
                    {ImageUploadComponent ? (
                      <div className="w-full">
                        <ImageUploadComponent
                          label="Upload Image (Auto-Compress)"
                          onUploadSuccess={(url) => {
                            setProductForm(prev => ({ ...prev, image: url }));
                            setImageUploadError('');
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={imageUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {imageUploading ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin text-lime-400" /> Uploading {imageUploadProgress}%...</>
                        ) : (
                          <><Upload className="w-3.5 h-3.5 text-lime-400" /> Upload Image from Device</>
                        )}
                      </button>
                    )}

                    {imageUploadError && (
                      <p className="text-[11px] text-rose-400 font-medium">{imageUploadError}</p>
                    )}

                    {/* Manual URL input fallback */}
                    <input
                      type="text"
                      value={productForm.image}
                      onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                      placeholder="Or enter URL / file path"
                      className="w-full bg-black border border-zinc-800 text-white rounded-xl p-2.5 text-xs focus:border-lime-500 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Preset SVG Icons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase mr-1">Presets:</span>
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
                          : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
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
                    placeholder="e.g. Item Type or Size"
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Badge / Tag (Optional)</label>
                  <input
                    type="text"
                    value={productForm.tag}
                    onChange={e => setProductForm({ ...productForm, tag: e.target.value })}
                    placeholder="e.g. Made to Order or Popular"
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
                  placeholder="e.g. Keyring, Bookmark, Dog Tag or Small, Medium, Large"
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Custom design details, materials, specs..."
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="inStockCheck"
                  checked={productForm.inStock}
                  onChange={e => setProductForm({ ...productForm, inStock: e.target.checked })}
                  className="w-4 h-4 accent-lime-500 rounded cursor-pointer"
                />
                <label htmlFor="inStockCheck" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer">
                  In Stock &amp; Available for Order
                </label>
              </div>

              {saveError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3 text-lime-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsCreatingProduct(false); setEditingProduct(null); }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct || imageUploading}
                  className="flex-1 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  {isSavingProduct ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Saving Product...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Product</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Design Gallery Edit / Create Modal */}
      {isCreatingDesign && (
        <div
          id="design-modal-backdrop"
          onClick={(e) => {
            if (e.target.id === 'design-modal-backdrop' && !isSavingDesign) {
              setIsCreatingDesign(false);
              setEditingDesign(null);
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex justify-center items-start p-3 sm:p-6 overscroll-contain animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl my-4 sm:my-8"
          >
            <button
              type="button"
              onClick={() => { setIsCreatingDesign(false); setEditingDesign(null); }}
              className="absolute top-6 right-6 p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              {editingDesign ? 'Edit Gallery Design Variation' : 'Add New Gallery Design Variation'}
            </h3>

            <form onSubmit={handleSaveDesign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Design Title</label>
                <input
                  type="text"
                  required
                  value={designForm.title}
                  onChange={e => setDesignForm({ ...designForm, title: e.target.value })}
                  placeholder="e.g. Neon Drift, Kanjo Night, Turbo Blueprint"
                  className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Category</label>
                  <select
                    value={designForm.category}
                    onChange={e => setDesignForm({ ...designForm, category: e.target.value })}
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  >
                    <option value="Cyberpunk & Drift">Cyberpunk & Drift</option>
                    <option value="JDM Heritage">JDM Heritage</option>
                    <option value="Engineering & Tech">Engineering & Tech</option>
                    <option value="Retro Motorsport">Retro Motorsport</option>
                    <option value="Custom Graphics">Custom Graphics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Badge Tag (Optional)</label>
                  <input
                    type="text"
                    value={designForm.tag}
                    onChange={e => setDesignForm({ ...designForm, tag: e.target.value })}
                    placeholder="e.g. Popular, Best Seller, New"
                    className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
                  />
                </div>
              </div>

              {/* Design Image Upload & Preset Selector */}
              <div className="space-y-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-lime-400" /> Design Artwork Graphic
                  </label>
                  {designForm.image && (
                    <span className="text-[10px] text-lime-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Image Selected
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  {designForm.image ? (
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-zinc-700 shrink-0 bg-black">
                      <img
                        src={designForm.image}
                        alt="Design Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDesignForm({ ...designForm, image: '' })}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/80 text-rose-400 hover:text-rose-300 transition-colors"
                        title="Remove Image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-500 shrink-0 bg-zinc-950">
                      <ImageIcon className="w-6 h-6 mb-1 text-zinc-600" />
                      <span className="text-[9px] font-bold">No Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="file"
                      ref={designFileInputRef}
                      onChange={handleDesignImageFileChange}
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => designFileInputRef.current?.click()}
                        disabled={designImageUploading}
                        className="bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        {designImageUploading ? 'Uploading...' : 'Upload Design Image'}
                      </button>

                      {/* Quick Presets */}
                      <button
                        type="button"
                        onClick={() => setDesignForm({ ...designForm, image: '/merch/designs/neon-drift.svg' })}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-2 rounded-xl text-[11px] font-medium border border-zinc-700"
                      >
                        Neon Drift SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesignForm({ ...designForm, image: '/merch/designs/kanjo-night.svg' })}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-2 rounded-xl text-[11px] font-medium border border-zinc-700"
                      >
                        Kanjo SVG
                      </button>
                    </div>

                    {designImageUploading && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-lime-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${designImageProgress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">Processing artwork image: {designImageProgress}%</p>
                      </div>
                    )}

                    {designImageError && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {designImageError}
                      </p>
                    )}

                    <div>
                      <input
                        type="text"
                        value={designForm.image}
                        onChange={e => setDesignForm({ ...designForm, image: e.target.value })}
                        placeholder="Or paste artwork URL..."
                        className="w-full bg-black/80 border border-zinc-800 text-white rounded-xl px-3 py-1.5 text-xs focus:border-lime-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {designSaveError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{designSaveError}</span>
                </div>
              )}

              {designSaveSuccess && (
                <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3 text-lime-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{designSaveSuccess}</span>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsCreatingDesign(false); setEditingDesign(null); }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDesign || designImageUploading}
                  className="flex-1 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  {isSavingDesign ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Saving Design...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Gallery Design</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Design Variations Upload Modal */}
      {isBulkUploading && (
        <div
          id="bulk-design-modal-backdrop"
          onClick={(e) => {
            if (e.target.id === 'bulk-design-modal-backdrop' && !isProcessingBulk) {
              setIsBulkUploading(false);
            }
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex justify-center items-start p-3 sm:p-6 overscroll-contain animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl my-4 sm:my-8 space-y-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 block mb-1">
                  Design Variations Catalog
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <UploadCloud className="w-6 h-6 text-lime-400" />
                  Bulk Upload Design Variations
                </h3>
                <p className="text-zinc-400 text-xs mt-1">
                  Select multiple design graphics at once. Titles are auto-generated from file names and can be customized below. Descriptions are left out as requested.
                </p>
              </div>
              <button
                type="button"
                disabled={isProcessingBulk}
                onClick={() => setIsBulkUploading(false)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Category for this batch:
              </label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                disabled={isProcessingBulk}
                className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm focus:border-lime-500 outline-none"
              >
                <option value="Custom Graphics">Custom Graphics</option>
                <option value="Cyberpunk & Drift">Cyberpunk & Drift</option>
                <option value="JDM Heritage">JDM Heritage</option>
                <option value="Engineering & Tech">Engineering & Tech</option>
                <option value="Retro Motorsport">Retro Motorsport</option>
              </select>
            </div>

            {/* Hidden multi-file input */}
            <input
              type="file"
              ref={bulkFileInputRef}
              onChange={handleBulkFilesSelect}
              multiple
              accept="image/*"
              className="hidden"
            />

            {/* File Drop / Select Area */}
            <div
              onClick={() => {
                if (!isProcessingBulk) bulkFileInputRef.current?.click();
              }}
              className="border-2 border-dashed border-zinc-700 hover:border-lime-500/70 bg-black/50 hover:bg-black/80 rounded-2xl p-6 text-center cursor-pointer transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 group-hover:bg-lime-500/10 border border-zinc-800 group-hover:border-lime-500/30 text-zinc-400 group-hover:text-lime-400 flex items-center justify-center mx-auto mb-3 transition-colors">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-white text-sm font-bold">
                Click to browse &amp; select multiple design image files
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                Supports PNG, JPG, WEBP, SVG • Select 1, 5, 10, or more graphics together
              </p>
            </div>

            {/* Queue List */}
            {bulkQueue.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Selected Designs to Upload ({bulkQueue.length}):
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isProcessingBulk}
                      onClick={() => bulkFileInputRef.current?.click()}
                      className="text-xs text-lime-400 hover:underline font-bold"
                    >
                      + Add More Files
                    </button>
                    <span className="text-zinc-700">•</span>
                    <button
                      type="button"
                      disabled={isProcessingBulk}
                      onClick={() => setBulkQueue([])}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 divide-y divide-zinc-800/40">
                  {bulkQueue.map((item) => (
                    <div
                      key={item.id}
                      className="pt-2.5 flex items-center gap-3 bg-black/40 border border-zinc-800/80 rounded-xl p-2.5"
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black border border-zinc-700 shrink-0">
                        {item.preview ? (
                          <img
                            src={item.preview}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-0.5">
                          Design Title (Required):
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          disabled={isProcessingBulk}
                          onChange={(e) => handleUpdateBulkTitle(item.id, e.target.value)}
                          placeholder="e.g. Neon Horizon"
                          className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isProcessingBulk}
                        onClick={() => handleRemoveBulkItem(item.id)}
                        className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                        title="Remove from batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error and Success Banners */}
            {bulkError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {bulkSuccess && (
              <div className="bg-lime-500/10 border border-lime-500/30 rounded-xl p-3 text-lime-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bulkSuccess}</span>
              </div>
            )}

            {/* Upload Progress Bar */}
            {isProcessingBulk && (
              <div className="space-y-1.5 bg-black/60 p-3 rounded-xl border border-zinc-800">
                <div className="flex justify-between text-xs text-zinc-300 font-bold">
                  <span>Saving Designs to Gallery...</span>
                  <span className="font-mono text-lime-400">{bulkProgress} / {bulkQueue.length}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-lime-400 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${bulkQueue.length ? Math.round((bulkProgress / bulkQueue.length) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                disabled={isProcessingBulk}
                onClick={() => setIsBulkUploading(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingBulk || bulkQueue.length === 0}
                onClick={handleProcessBulkUpload}
                className="flex-1 bg-gradient-to-r from-pink-500 to-lime-400 hover:from-pink-400 hover:to-lime-300 disabled:opacity-50 text-black font-black py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-lime-500/20 flex items-center justify-center gap-2 transition-all"
              >
                {isProcessingBulk ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading ({bulkProgress}/{bulkQueue.length})...</>
                ) : (
                  <><Save className="w-4 h-4" /> Upload &amp; Save All ({bulkQueue.length}) Designs</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
