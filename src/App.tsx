import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, onSnapshot, orderBy, where, addDoc, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Instagram, Calendar, User as UserIcon, LogOut, ShieldCheck, ChevronRight, Check, MapPin, Phone, MessageSquare, ArrowRight, ChevronDown, Mail } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { UserProfile, PhotographyService, Booking, PortfolioItem, BookingStatus } from './types';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

// --- Contexts ---
const AuthContext = createContext<{
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  login: async () => {},
  logout: async () => {},
});

const useAuth = () => useContext(AuthContext);

// --- Providers ---
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'Guest',
              isAdmin: u.email === 'ssoosooer@gmail.com', // Bootstrap admin
              createdAt: new Date().toISOString(),
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.isAdmin || false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Components ---

function AvailabilityViewer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'bookings'), where('status', 'in', ['pending', 'confirmed']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isOpen]);

  const amSlot = 'AM (MORNING)';
  const pmSlot = 'PM (AFTERNOON)';

  const getDayAvailability = (dateStr: string) => {
    const dayBookings = bookings.filter(b => b.date === dateStr);
    const isAmTaken = dayBookings.some(b => b.timeSlot === amSlot);
    const isPmTaken = dayBookings.some(b => b.timeSlot === pmSlot);
    return { am: !isAmTaken, pm: !isPmTaken };
  };

  const availability = getDayAvailability(selectedDate);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-xl w-full p-12 shadow-2xl relative border border-brand-black/5"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-brand-black/20 hover:text-brand-black transition-colors">
          <X size={24} />
        </button>

        <h3 className="text-3xl font-serif mb-10 uppercase tracking-tighter">Reservation Availability</h3>
        
        <div className="space-y-12">
            <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-black/40 block">01. Select Date</label>
                <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full border-b border-brand-black/10 py-4 text-2xl font-serif focus:outline-none focus:border-brand-accent transition-all bg-transparent rounded-none"
                    min={new Date().toISOString().split('T')[0]}
                />
            </div>

            <div className="space-y-8">
                <label className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-black/40 block">02. Status</label>
                <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                        "p-10 border flex flex-col items-center justify-center gap-4 transition-all duration-500",
                        availability.am ? "border-brand-black/5 bg-brand-offwhite" : "border-red-100 bg-red-50/50 opacity-40"
                    )}>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/30">Morning (AM)</span>
                        <span className={cn("text-xl font-serif", availability.am ? "text-brand-black" : "text-red-900")}>
                            {availability.am ? 'AVAILABLE' : 'BOOKED'}
                        </span>
                        {availability.am && <div className="w-1.5 h-1.5 bg-brand-accent animate-pulse" />}
                    </div>
                    <div className={cn(
                        "p-10 border flex flex-col items-center justify-center gap-4 transition-all duration-500",
                        availability.pm ? "border-brand-black/5 bg-brand-offwhite" : "border-red-100 bg-red-50/50 opacity-40"
                    )}>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/30">Afternoon (PM)</span>
                        <span className={cn("text-xl font-serif", availability.pm ? "text-brand-black" : "text-red-900")}>
                            {availability.pm ? 'AVAILABLE' : 'BOOKED'}
                        </span>
                        {availability.pm && <div className="w-1.5 h-1.5 bg-brand-accent animate-pulse" />}
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-brand-black/5 flex flex-col gap-6">
                <p className="text-[11px] text-brand-black/40 font-light leading-relaxed">
                    * The schedule is updated in real-time. If the time slot is booked, please select another date.
                </p>
                <Link 
                    to="/booking" 
                    onClick={onClose}
                    className="bg-brand-black text-white px-12 py-5 font-bold uppercase tracking-[0.3em] hover:bg-brand-accent transition-all text-center shadow-xl"
                >
                    Book This Date
                </Link>
            </div>
        </div>
      </motion.div>
    </div>
  );
}

function Navbar() {
  const { user, profile, login, logout, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const links = [
    { name: 'PORTFOLIO', path: '/portfolio' },
    { name: 'SERVICES', path: '/services' },
  ];

  const [isPortfolioHovered, setIsPortfolioHovered] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-black/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-2xl font-serif font-bold tracking-tighter uppercase">
          pno
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-10">
          {/* Portfolio with Dropdown */}
          <div 
            className="relative h-full flex items-center"
            onMouseEnter={() => setIsPortfolioHovered(true)}
            onMouseLeave={() => setIsPortfolioHovered(false)}
          >
            <Link
              to="/portfolio"
              className={cn(
                "text-sm font-medium tracking-wide transition-colors hover:text-brand-accent h-20 flex items-center gap-1",
                location.pathname === '/portfolio' ? "text-brand-black underline decoration-brand-accent underline-offset-8" : "text-brand-black/60"
              )}
            >
              PORTFOLIO
              <ChevronDown size={14} className={cn("transition-transform duration-300", isPortfolioHovered && "rotate-180")} />
            </Link>

            <AnimatePresence>
              {isPortfolioHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-20 left-0 bg-white border border-brand-black/5 shadow-2xl py-4 min-w-[180px] z-50 overflow-hidden"
                >
                  {[
                    { name: 'PROFILE', tab: 'profile', label: 'Individual' },
                    { name: 'PRODUCT', tab: 'product', label: 'Commercial' },
                    { name: 'SNAP', tab: 'snap', label: 'Emotional' }
                  ].map((item) => (
                    <Link
                      key={item.tab}
                      to={`/portfolio?tab=${item.tab}`}
                      className="flex flex-col px-6 py-3 hover:bg-brand-offwhite transition-colors group"
                    >
                      <span className="text-xs font-bold uppercase tracking-widest text-brand-black group-hover:text-brand-accent">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-brand-black/30 font-light mt-1">
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {links.filter(l => l.name !== 'PORTFOLIO').map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "text-sm font-medium tracking-wide transition-colors hover:text-brand-accent",
                location.pathname === link.path ? "text-brand-black underline decoration-brand-accent underline-offset-8" : "text-brand-black/60"
              )}
            >
              {link.name}
            </Link>
          ))}
          
          <div className="h-4 w-px bg-brand-black/10 mx-2" />

          {user ? (
            <div className="flex items-center gap-6">
              <Link to="/mypage" className="text-brand-black/60 hover:text-brand-black transition-colors">
                <UserIcon size={20} />
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-brand-black/60 hover:text-brand-black transition-colors">
                  <ShieldCheck size={20} />
                </Link>
              )}
              <button onClick={logout} className="text-brand-black/60 hover:text-brand-black transition-colors">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button onClick={login} className="text-sm font-bold uppercase tracking-widest border border-brand-black px-6 py-2 hover:bg-brand-black hover:text-white transition-all">
              LOGIN
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-brand-black/10 px-6 py-10 flex flex-col gap-8 shadow-2xl"
          >
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className="text-2xl font-serif text-brand-black"
              >
                {link.name}
              </Link>
            ))}
            {user ? (
              <div className="flex items-center justify-between border-t pt-8">
                <Link to="/mypage" onClick={() => setIsOpen(false)} className="flex items-center gap-2">
                  <UserIcon size={20} /> <span className="font-medium uppercase text-sm tracking-widest">My Page</span>
                </Link>
                <button onClick={() => { logout(); setIsOpen(false); }} className="flex items-center gap-2 text-red-500 font-medium uppercase text-sm tracking-widest">
                  <LogOut size={20} /> <span>Logout</span>
                </button>
              </div>
            ) : (
              <button onClick={() => { login(); setIsOpen(false); }} className="w-full border border-brand-black py-4 font-bold uppercase text-sm tracking-widest">
                Login
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-black text-white pt-24 pb-12 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-white/10 pb-20">
        <div className="col-span-1 md:col-span-2">
          <h2 className="text-4xl font-serif font-bold tracking-tighter mb-6 uppercase">PNO</h2>
          <p className="text-white/60 max-w-sm mb-8 font-light leading-relaxed break-keep">
            당신이 몰랐던 가장 좋은 얼굴을 찾아 드립니다. <br className="hidden md:block" />
            사진을 찍는 것을 넘어, 당신의 자신감을 완성하는 <br className="hidden md:block" />
            프리미엄 포트레이트 스튜디오입니다.
          </p>
          <div className="flex gap-6 mb-8">
            <a href="https://www.instagram.com/p.no_photo/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-accent transition-colors"><Instagram size={24} /></a>
            <a href="#" className="hover:text-brand-accent transition-colors"><MessageSquare size={24} /></a>
          </div>
          <Link to="/booking" className="inline-flex items-center gap-4 bg-brand-accent text-white px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-brand-black transition-all">
            <Calendar size={18} />
            DIRECT BOOKING
          </Link>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">Contact</h3>
          <ul className="space-y-4 text-sm font-light mb-8">
            <li className="flex items-center gap-3"><Phone size={16} /> 010-5112-4980</li>
            <li className="flex items-center gap-3"><Mail size={16} /> ssoosooer@naver.com</li>
            <li className="flex items-center gap-3 text-brand-accent underline underline-offset-4">Kakao: pno</li>
          </ul>
          <Link to="/booking" className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] border border-white/20 px-6 py-3 hover:bg-white hover:text-brand-black transition-all group">
            <Calendar size={14} className="text-brand-accent group-hover:text-brand-black" />
            Reservation
          </Link>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">MENU</h3>
          <ul className="space-y-4 text-sm font-light">
            <li><Link to="/portfolio" className="hover:text-brand-accent transition-colors">PORTFOLIO</Link></li>
            <li><Link to="/services" className="hover:text-brand-accent transition-colors">SERVICES</Link></li>
            <li><Link to="/booking" className="hover:text-brand-accent transition-colors">RESERVATION</Link></li>
            <li><Link to="/admin" className="hover:text-brand-accent transition-colors text-white/20">ADMIN</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto pt-10 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest text-white/40 break-keep">
        <p className="text-center md:text-left">© 2026 PNO. ALL RIGHTS RESERVED.</p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}

// --- Pages ---

function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentImg, setCurrentImg] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const heroSlides = [
    {
      title: "PROFILE",
      subtitle: "인물을 찍기보다 어떤 사람으로 보일지를 설계합니다.",
      desc: "PROFILE · 광고 · 배우 프로필 · 인터뷰 · 룩북",
      images: [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=2574&auto=format&fit=crop", // Profile 1
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2574&auto=format&fit=crop"  // Profile 2
      ],
      path: "/portfolio?tab=profile"
    },
    {
      title: "PRODUCT",
      subtitle: "브랜드의 가치를 시각적으로 완성하는 기록을 지향합니다.",
      desc: "PRODUCT · 브랜드 룩북 · 상업 사진 · 공간 기록",
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=2574&auto=format&fit=crop", // Product 1
        "https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=2574&auto=format&fit=crop"  // Product 2
      ],
      path: "/portfolio?tab=product"
    },
    {
      title: "SNAP",
      subtitle: "일상적인 공간에서 당신의 가장 빛나는 순간을 포착합니다.",
      desc: "SNAP · 야외 촬영 · 데일리 화보 · 감성 기록",
      images: [
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=2574&auto=format&fit=crop", // Snap 1
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2574&auto=format&fit=crop"  // Snap 2
      ],
      path: "/portfolio?tab=snap"
    }
  ];

  // Manual navigation only (auto-sliding disabled)
  const handleSlideChange = (index: number) => {
    setCurrentSlide(index);
    setCurrentImg(0);
  };
  
  return (
    <div className="flex flex-col">
      {/* Split Hero Section */}
      <section className="flex flex-col lg:flex-row min-h-[90vh] bg-white overflow-hidden">
        {/* Left: Brand Description */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 bg-brand-offwhite/50 border-r border-brand-black/5">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-xl space-y-12"
          >
            <div className="space-y-6">
              <h2 className="text-5xl md:text-6xl font-serif tracking-tight text-brand-black leading-tight uppercase">
                PEOPLE NEAR <br /> OBJECTS
              </h2>
              <div className="space-y-4 text-brand-black/60 font-light leading-relaxed">
                <p className="text-xl font-medium text-brand-black/80">당신만이 가진 고유한 분위기를 담아냅니다</p>
                <p className="text-lg leading-relaxed break-keep">
                  대부분의 카메라 앞에서는 어색함을 느낍니다. <br />
                  우리는 그 찰나의 긴장을 넘어, 당신조차 발견하지 못했던 가장 자연스럽고 아름다운 순간을 기록합니다.
                </p>
                <p className="text-lg leading-relaxed break-keep">
                  개인의 오리지널리티가 돋보이는 1:1 맞춤형 촬영으로, 시간이 흘러도 변치 않는 가치를 전달하는 pno만의 시선을 경험해 보세요.
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {[
                "개인 맞춤형 프리미엄 프로필",
                "브랜드 가치를 시각화하는 프로덕트 촬영",
                "감성적인 야외/실내 포토 스냅"
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-4 border border-brand-black/5 bg-white p-5 shadow-sm transition-all hover:border-brand-accent/30">
                  <div className="w-1.5 h-1.5 bg-brand-accent" />
                  <span className="text-sm font-bold uppercase tracking-tight">{text}</span>
                </li>
              ))}
            </ul>

            <div className="pt-10 border-t border-brand-black/10 flex flex-col md:flex-row items-start md:items-center gap-12">
              <div className="space-y-2 bg-brand-accent/5 p-4 pr-12 border-l-2 border-brand-accent">
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-brand-black/40">CONTACT</p>
                <p className="text-sm font-bold tracking-tight">ssoosooer@naver.com</p>
                <p className="text-sm font-bold tracking-tight">010-5112-4980</p>
              </div>
              <div className="flex flex-col gap-6">
                <Link to="/portfolio" className="group flex items-center gap-4 text-xs font-bold uppercase tracking-[0.4em] text-brand-black hover:text-brand-accent transition-all">
                  SEE MORE <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
                </Link>
                <Link to="/booking" className="inline-flex items-center justify-center bg-brand-black text-white px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-accent transition-all w-fit">
                  <Calendar size={16} className="mr-3" />
                  RESERVATION NOW
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right: Automatic Slider */}
        <div className="w-full lg:w-1/2 relative h-[700px] lg:h-auto overflow-hidden bg-brand-black">
          <Link to={heroSlides[currentSlide].path} className="block w-full h-full relative cursor-pointer group">
            {/* Image Transition Layer */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentSlide}-${currentImg}`}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0"
              >
                <img 
                  src={heroSlides[currentSlide].images[currentImg]} 
                  alt={heroSlides[currentSlide].title}
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000 scale-105 group-hover:scale-100"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 via-transparent to-transparent group-hover:from-brand-black/60 transition-all duration-700 z-[5]" />
            
            {/* Text Transition Layer - Persistent while images cycle */}
            <div className="absolute bottom-20 left-20 text-white max-w-lg z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 1 }}
                >
                  <h3 className="text-5xl md:text-7xl font-serif mb-6 uppercase tracking-tighter leading-none">
                    {heroSlides[currentSlide].title}
                  </h3>
                  <p className="text-xl opacity-90 leading-relaxed font-light mb-8 break-keep">
                    {heroSlides[currentSlide].subtitle}
                  </p>
                  <div className="flex items-center gap-6">
                    <span className="text-xs font-bold uppercase tracking-[0.4em] border-b border-white/40 pb-1 group-hover:border-white transition-all">
                      VIEW PORTFOLIO
                    </span>
                    <div className="flex gap-6">
                      {heroSlides.map((slide, i) => (
                        <button 
                          key={i}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSlideChange(i);
                          }}
                          className={cn(
                            "w-12 h-1 transition-all duration-500",
                            currentSlide === i ? "bg-brand-accent" : "bg-white/20 hover:bg-white/40"
                          )}
                          aria-label={`Go to slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Link>
        </div>
      </section>

      {/* Intro Text */}
      <section className="py-32 px-6 bg-white overflow-hidden">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 className="text-xs uppercase tracking-[0.4em] text-brand-black/40 mb-8">BRAND PHILOSOPHY</h2>
                    <p className="text-2xl md:text-3xl font-serif leading-[1.6] text-justify md:text-center px-4">
                        "대부분의 카메라 앞에서는 어색함을 느낍니다. <br className="hidden md:block" />
                        우리는 그 찰나의 긴장을 넘어, 당신조차 발견하지 못했던 <br className="hidden md:block" />
                        가장 자연스럽고 아름다운 순간을 기록합니다."
                    </p>
                </div>
      </section>

      {/* Portfolio Categories */}
      <section className="py-32 px-6 bg-brand-offwhite overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-xs uppercase tracking-[0.4em] text-brand-black/40 mb-4 font-bold">CATEGORIES</h2>
            </div>
            <div className="flex items-center gap-8 hidden md:flex">
              <button 
                onClick={() => setIsViewerOpen(true)}
                className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest flex items-center gap-3 hover:bg-brand-black transition-all"
              >
                <Calendar size={14} />
                일정 보기
              </button>
              <Link to="/portfolio" className="text-sm font-bold uppercase border-b-2 border-brand-accent pb-1">VIEW ALL</Link>
            </div>
          </div>

          <AvailabilityViewer isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-20 mt-20">
            {[
              { 
                title: 'INDIVIDUAL PROFILE', 
                cat: 'profile',
                imgs: [
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2574&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=2576&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2574&auto=format&fit=crop'
                ]
              },
              { 
                title: 'COMMERCIAL PRODUCT', 
                cat: 'product',
                imgs: [
                  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=2599&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=2670&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=2680&auto=format&fit=crop'
                ]
              },
              { 
                title: 'EMOTIONAL SNAP', 
                cat: 'snap',
                imgs: [
                  'https://images.unsplash.com/photo-1542285442-7632669e2c66?q=80&w=2574&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1520390138845-fd2d229dd553?q=80&w=2664&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=2538&auto=format&fit=crop'
                ]
              }
            ].map((item, i) => (
              <Link 
                to={`/portfolio?tab=${item.cat}`}
                key={i}
                className="group cursor-pointer block border-none outline-none focus:outline-none"
              >
                <motion.div 
                  initial="initial"
                  whileHover="hover"
                  className="relative"
                >
                  <div className="relative aspect-[4/5] z-30">
                    {/* Top Image */}
                    <motion.div 
                      variants={{
                        initial: { rotate: 0, x: 0, y: 0, scale: 1 },
                        hover: { rotate: -2, x: -10, y: -20, scale: 1.02 }
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="absolute inset-0 bg-brand-black shadow-2xl z-20 overflow-hidden"
                    >
                      <img 
                          src={item.imgs[0]} 
                          alt={item.title} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" 
                          referrerPolicy="no-referrer" 
                      />
                      <div className="absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/20 transition-all duration-500" />
                    </motion.div>
                    
                    {/* Second Image (Spreading out) */}
                    <motion.div 
                      variants={{
                        initial: { rotate: 0, x: 0, y: 0, opacity: 0, scale: 0.95 },
                        hover: { rotate: 4, x: 20, y: 40, opacity: 1, scale: 1 }
                      }}
                      transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.05 }}
                      className="absolute inset-0 bg-brand-black shadow-xl overflow-hidden z-10"
                    >
                      <img 
                          src={item.imgs[1]} 
                          alt={item.title} 
                          className="w-full h-full object-cover opacity-90" 
                          referrerPolicy="no-referrer" 
                      />
                    </motion.div>

                    {/* Third Image (Spreading out further) */}
                    <motion.div 
                      variants={{
                        initial: { rotate: 0, x: 0, y: 0, opacity: 0, scale: 0.9 },
                        hover: { rotate: 10, x: 40, y: 100, opacity: 1, scale: 1 }
                      }}
                      transition={{ type: "spring", stiffness: 150, damping: 25, delay: 0.1 }}
                      className="absolute inset-0 bg-brand-black shadow-lg overflow-hidden z-0"
                    >
                      <img 
                          src={item.imgs[2]} 
                          alt={item.title} 
                          className="w-full h-full object-cover opacity-80" 
                          referrerPolicy="no-referrer" 
                      />
                    </motion.div>
                  </div>

                  <motion.div 
                    variants={{
                      initial: { y: 0 },
                      hover: { y: 100 }
                    }}
                    transition={{ type: "spring", stiffness: 150, damping: 25, delay: 0.1 }}
                    className="mt-12 text-center"
                  >
                    <p className="text-[10px] uppercase tracking-[0.4em] text-brand-black/40 mb-2 font-bold">{item.cat}</p>
                    <h4 className="text-xl font-serif tracking-tighter">{item.title}</h4>
                  </motion.div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
          <div>
            <h2 className="text-xs uppercase tracking-[0.4em] text-brand-black/40 mb-6">OUR PROCESS</h2>
            <h3 className="text-6xl font-serif mb-12 leading-[1.1]">촬영은 1시간, <br /> 결과는 <span className="text-brand-accent">평생 남습니다.</span></h3>
            
            <div className="space-y-10">
              {[
                { step: '01', title: 'CONSULTATION', desc: '촬영 목적과 무드, 브랜드가 지향하는 이미지를 사전에 조율합니다.' },
                { step: '02', title: 'CONCEPT SHOOT', desc: '조명과 공간의 미학을 활용하여 가장 피사체다운 모습을 담아냅니다.' },
                { step: '03', title: 'FINE-TUNING', desc: 'pno만의 감도를 유지하면서도 디테일을 살린 전문적인 보정을 진행합니다.' },
                { step: '04', title: 'DELIVERY', desc: '시간이 흘러도 가치가 변하지 않는 고화질 결과물을 전달해 드립니다.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-8 group">
                  <span className="text-2xl font-serif text-brand-black/20 group-hover:text-brand-accent transition-colors">{item.step}</span>
                  <div>
                    <h4 className="text-xl font-bold uppercase tracking-widest mb-2">{item.title}</h4>
                    <p className="text-brand-black/60 font-light">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[3/4]">
             <img 
               src="https://images.unsplash.com/photo-1492633423870-43d1cd2775ff?q=80&w=2670&auto=format&fit=crop" 
               className="w-full h-full object-cover shadow-2xl grayscale"
               alt="Studio vibe"
               referrerPolicy="no-referrer"
             />
             <div className="absolute -bottom-10 -right-10 bg-brand-accent text-white p-12 hidden lg:block max-w-[280px]">
                <p className="text-2xl font-serif mb-6 leading-tight uppercase">"Beyond the tension, we define your essence."</p>
                <div className="h-0.5 w-12 bg-white/40" />
             </div>
          </div>
        </div>
      </section>

      {/* Testimonials or Final CTA */}
      <section className="py-32 bg-brand-black text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-6xl md:text-8xl font-serif mb-12 translate-x-0 break-keep"> 당신을 발견하는 <br /> <span className="text-brand-accent">가장 완벽한 순간</span></h2>
          <p className="text-xl font-light text-white/60 mb-12">지금 예약하고 새로운 당신의 기준을 경험하세요.</p>
          <Link to="/booking" className="inline-block bg-white text-brand-black px-12 py-6 text-lg font-bold uppercase tracking-widest hover:bg-brand-accent hover:text-white transition-all transform hover:scale-105 shadow-2xl">
            RESERVATION
          </Link>
        </div>
      </section>
    </div>
  );
}

function PortfolioPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') as 'profile' | 'snap' | 'product' | null;
    const [activeTab, setActiveTab] = useState<'profile' | 'snap' | 'product'>(tabFromUrl || 'profile');
    
    useEffect(() => {
        if (tabFromUrl && (tabFromUrl === 'profile' || tabFromUrl === 'snap' || tabFromUrl === 'product')) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);

    const handleTabChange = (tab: 'profile' | 'snap' | 'product') => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };
    
    const categories = [
        { id: 'profile', label: 'PROFILE' },
        { id: 'product', label: 'PRODUCT' },
        { id: 'snap', label: 'SNAP' }
    ];

    return (
        <div className="py-24 px-6 bg-white min-h-screen">
            <div className="max-w-7xl mx-auto">
                <header className="mb-20 text-center">
                    <h1 className="text-7xl font-serif mb-6">GALLERY</h1>
                    <div className="flex justify-center gap-8 border-b border-brand-black/10 pb-4">
                        {categories.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => handleTabChange(cat.id as any)}
                                className={cn(
                                    "text-xs uppercase tracking-[0.3em] font-bold transition-all",
                                    activeTab === cat.id ? "text-brand-accent" : "text-brand-black/30 hover:text-brand-black"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 grid-flow-dense">
                    {[1,2,3,4,5,6].map((i) => (
                        <motion.div 
                            layout
                            key={`${activeTab}-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn("overflow-hidden group relative bg-gray-100", (i + (activeTab === 'product' ? 1 : 0)) % 4 === 0 ? "md:row-span-2" : "")}
                        >
                            <img 
                                src={`https://picsum.photos/seed/${activeTab}-${i}/800/${(i + (activeTab === 'product' ? 1 : 0)) % 4 === 0 ? 1200 : 800}?grayscale&blur=0`} 
                                className="w-full h-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                                alt={`${activeTab} portfolio`}
                            />
                            <div className="absolute inset-0 bg-brand-black/0 group-hover:bg-brand-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <span className="text-white font-serif text-2xl uppercase tracking-widest">Perspective</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function ServicesPage() {
    return (
        <div className="py-24 px-6 bg-brand-offwhite min-h-screen">
            <div className="max-w-5xl mx-auto">
                <header className="mb-24 text-center">
                    <h2 className="text-xs uppercase tracking-[0.4em] text-brand-black/40 mb-6">OUR SERVICES</h2>
                    <h1 className="text-6xl font-serif mb-8 leading-tight">가장 나다운 기록을 위한 <br /> <span className="text-brand-accent">섬세한 약속</span></h1>
                </header>

                {/* Service Workflow Table */}
                <section className="bg-white p-12 shadow-2xl mb-24 overflow-x-auto">
                    <h3 className="text-2xl font-serif mb-10 border-b pb-4">WORKFLOW</h3>
                    <table className="w-full text-left min-w-[600px]">
                        <thead className="text-[10px] uppercase tracking-widest text-brand-black/40 bg-brand-offwhite">
                            <tr>
                                <th className="p-6">PHASE</th>
                                <th className="p-6">DESCRIPTION</th>
                                <th className="p-6">TIMING</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-light">
                            {[
                                { phase: '01. CONSULTATION', desc: '홈페이지를 통한 예약 후, 촬영 희망 컨셉과 장소에 대한 1:1 상담을 진행합니다.', time: 'D-7' },
                                { phase: '02. OUTDOOR SHOOT', desc: '자연 광 아래에서 pno만의 감성을 담아 1시간 동안 가장 빛나는 순간을 기록합니다.', time: 'DAY OF SHOOT' },
                                { phase: '03. RETOUCHING', desc: '촬영본 중 베스트 컷을 선정하여 야외 무드가 살아나는 정교한 보정을 진행합니다.', time: '7-10 DAYS AFTER' },
                                { phase: '04. DELIVERY', desc: '최종 완성된 데이터본과 정성스러운 패키징이 포함된 인화물을 전달해 드립니다.', time: 'COMPLETE' },
                            ].map((item, i) => (
                                <tr key={i} className="border-b border-brand-black/5 hover:bg-brand-offwhite transition-colors">
                                    <td className="p-6 font-bold uppercase tracking-tight">{item.phase}</td>
                                    <td className="p-6 text-brand-black/60 leading-relaxed text-justify">{item.desc}</td>
                                    <td className="p-6 font-mono text-xs text-brand-accent">{item.time}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
                    <div className="bg-brand-black text-white p-16 hover:shadow-2xl transition-all duration-500 border border-white/5 group">
                        <div className="w-12 h-0.5 bg-brand-accent mb-8 group-hover:w-24 transition-all" />
                        <h4 className="text-4xl font-serif mb-6 uppercase">Natural Snap</h4>
                        <p className="text-white/60 font-light mb-10 leading-[1.8] text-sm break-keep">
                            일상의 공기와 계절의 색감을 담는 pno의 시그니처 서비스입니다. 자연스러운 빛 아래에서 숨 쉬는 당신의 진실된 모습을 마주하는 시간을 선사합니다.
                        </p>
                        <ul className="space-y-4 mb-12 text-sm text-white/80">
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> 1-HOUR VIEWING SESSION</li>
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> CURATED SELECTIONS</li>
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> 10 RETOUCHED PHOTOS</li>
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> HIGH-RES JPG DELIVERY</li>
                        </ul>
                        <div className="flex justify-between items-baseline">
                            <p className="text-4xl font-serif text-brand-accent">₩70,000</p>
                            <Link to="/booking" className="text-[10px] font-bold uppercase tracking-[0.4em] border-b border-brand-accent pb-1 hover:text-brand-accent transition-colors">Book Now</Link>
                        </div>
                    </div>

                    <div className="bg-white p-16 shadow-xl hover:shadow-2xl transition-all duration-500 border border-brand-black/5 group">
                        <div className="w-12 h-0.5 bg-brand-accent mb-8 group-hover:w-24 transition-all" />
                        <h4 className="text-4xl font-serif mb-6 uppercase">Studio</h4>
                        <p className="text-brand-black/60 font-light mb-10 leading-[1.8] text-sm break-keep">
                            정교한 조명 설계와 미니멀한 공간에서 오직 인물의 본질에만 집중합니다. 렌탈 스튜디오를 활용한 촬영으로 진행되며, 공간 대여 비용은 고객님께서 별도로 지불해주셔야 합니다.
                        </p>
                        <ul className="space-y-4 mb-12 text-sm text-brand-black/80">
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> 1-HOUR STUDIO SESSION</li>
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> RENTAL SPACE (FEE BY CUSTOMER)</li>
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> PREMIUM RETOUCHED PHOTOS</li>
                            <li className="flex items-center gap-3"><Check size={14} className="text-brand-accent"/> ARTISTIC LIGHTING</li>
                        </ul>
                        <div className="flex justify-between items-baseline">
                            <p className="text-4xl font-serif text-brand-accent">₩100,000</p>
                            <Link to="/booking" className="text-[10px] font-bold uppercase tracking-[0.4em] border-b border-brand-accent pb-1 hover:text-brand-accent transition-colors">Book Now</Link>
                        </div>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto text-center border-t border-brand-black/5 pt-20">
                    <h3 className="text-3xl font-serif mb-8">NOTICE</h3>
                    <p className="text-sm font-light text-brand-black/60 leading-relaxed mb-12">
                        • 야외 촬영 특성상 우천 시 일정 변경이 가능합니다.<br />
                        • 촬영 7일 전까지는 100% 환불이 가능하며, 이후 차등 적용됩니다.<br />
                        • 의상 및 소품은 직접 준비해주셔야 하며, 필요시 상담 단계에서 추천해 드립니다.
                    </p>
                    <Link to="/booking" className="inline-block bg-brand-black text-white px-12 py-5 font-bold uppercase tracking-[0.4em] shadow-xl hover:bg-brand-accent transition-all duration-500">
                        RESERVATION
                    </Link>
                </div>
            </div>
        </div>
    );
}

function BookingPage() {
    const { user, profile, login } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [date, setDate] = useState<string>('');
    const [service, setService] = useState<string>('');
    const [time, setTime] = useState<string>('');
    const [userName, setUserName] = useState<string>('');
    const [userPhone, setUserPhone] = useState<string>('');
    const [bookingPurpose, setBookingPurpose] = useState<string>('');
    const [inquiry, setInquiry] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (profile?.displayName) {
            setUserName(profile.displayName);
        } else if (user?.displayName) {
            setUserName(user.displayName);
        }
    }, [profile, user]);

    const services = [
      { id: 'outdoor-snap', title: 'NATURAL SNAP', price: 70000, duration: 60, cat: 'natural' },
      { id: 'indoor-studio', title: 'STUDIO', price: 100000, duration: 60, cat: 'minimal' }
    ];

    const timeSlots = ['AM (MORNING)', 'PM (AFTERNOON)'];

    const [existingBookings, setExistingBookings] = useState<any[]>([]);

    useEffect(() => {
        const q = query(collection(db, 'bookings'), where('status', 'in', ['pending', 'confirmed']));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setExistingBookings(snapshot.docs.map(doc => doc.data()));
        });
        return () => unsubscribe();
    }, []);

    const isSlotTaken = (d: string, t: string) => {
        return existingBookings.some(b => b.date === d && b.timeSlot === t);
    };

    const handleBooking = async () => {
      if (!user) return login();
      setIsSubmitting(true);
      const path = 'bookings';
      try {
        await addDoc(collection(db, path), {
          userId: user.uid,
          serviceId: service,
          serviceTitle: services.find(s => s.id === service)?.title,
          date,
          timeSlot: time,
          status: 'pending',
          userEmail: user.email,
          userName,
          userPhone,
          bookingPurpose,
          inquiry,
          createdAt: new Date().toISOString()
        });
        setStep(4);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, path);
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!user) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center bg-brand-offwhite px-6 font-sans">
                <div className="max-w-md w-full bg-white p-12 shadow-2xl text-center border border-brand-black/5">
                    <h2 className="text-3xl font-serif mb-6 uppercase tracking-tighter">Booking pno</h2>
                    <p className="text-brand-black/60 mb-10 font-light leading-relaxed">
                        LOGIN REQUIRED <br /> TO START YOUR JOURNEY
                    </p>
                    <button onClick={login} className="w-full bg-brand-black text-white py-5 font-bold uppercase tracking-[0.2em] hover:bg-brand-accent transition-all duration-500 shadow-xl">
                        Google Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-32 pb-40 px-6 bg-brand-offwhite flex flex-col items-center font-sans text-brand-black">
            <div className="max-w-3xl w-full">
                {step < 4 && (
                    <div className="flex items-center justify-center gap-6 mb-24 text-[10px] font-bold uppercase tracking-[0.4em] text-brand-black/20">
                        <span className={cn("transition-colors duration-500", step >= 1 ? "text-brand-black" : "")}>01. Project</span>
                        <div className="w-8 h-px bg-current opacity-20" />
                        <span className={cn("transition-colors duration-500", step >= 2 ? "text-brand-black" : "")}>02. Schedule</span>
                        <div className="w-8 h-px bg-current opacity-20" />
                        <span className={cn("transition-colors duration-500", step >= 3 ? "text-brand-black" : "")}>03. Finalize</span>
                    </div>
                )}

                <div className="bg-white p-10 md:p-20 shadow-2xl relative overflow-hidden border border-brand-black/5">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div 
                              key="step1"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="w-full flex flex-col items-center"
                            >
                                <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                                    {services.map(s => (
                                        <button 
                                          key={s.id}
                                          onClick={() => { setService(s.id); setStep(2); }}
                                          className={cn(
                                              "py-16 px-10 border w-full transition-all duration-500 group relative border-brand-black/5 hover:border-brand-accent flex items-center justify-between",
                                              service === s.id ? "bg-brand-black text-white" : "hover:bg-brand-offwhite"
                                          )}
                                        >
                                            <div className="space-y-1">
                                                <p className={cn("text-[9px] uppercase tracking-[0.4em] font-bold", service === s.id ? "text-white/40" : "text-brand-black/40 group-hover:text-brand-accent")}>{s.cat}</p>
                                                <h4 className="text-2xl font-serif tracking-tighter uppercase">{s.title}</h4>
                                            </div>
                                            <div className="text-right">
                                                <p className={cn("text-2xl font-serif", service === s.id ? "text-brand-accent" : "text-brand-black")}>₩{s.price.toLocaleString()}</p>
                                                <p className={cn("text-[9px] uppercase tracking-widest", service === s.id ? "text-white/40" : "text-brand-black/20")}>{s.duration} MIN</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div 
                              key="step2"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="w-full flex flex-col items-center"
                            >
                                <button onClick={() => setStep(1)} className="text-[10px] items-center justify-center uppercase tracking-[0.3em] text-brand-black/40 mb-16 flex gap-3 mx-auto hover:text-brand-black transition-all">
                                  <ArrowRight size={14} className="rotate-180" /> CHANGE SERVICE
                                </button>
                                <h2 className="text-4xl md:text-5xl font-serif mb-20 text-center tracking-tight uppercase">Select Schedule</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-20 w-full mb-20">
                                    <div className="space-y-8">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/40 block">01. DATE</label>
                                        <input 
                                          type="date" 
                                          className="w-full border-b border-brand-black/10 py-4 text-2xl font-serif focus:outline-none focus:border-brand-accent transition-all bg-transparent rounded-none"
                                          onChange={(e) => setDate(e.target.value)}
                                          min={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                    <div className="space-y-8">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/40 block">02. TIME</label>
                                        <div className="grid grid-cols-1 gap-4 w-full">
                                            {timeSlots.map(t => (
                                                <button 
                                                  key={t}
                                                  disabled={!date || isSlotTaken(date, t)}
                                                  onClick={() => setTime(t)}
                                                  className={cn(
                                                      "p-6 border text-left transition-all duration-500 uppercase tracking-[0.2em] text-xs flex justify-between items-center group",
                                                      time === t ? "border-brand-black bg-brand-black text-white shadow-xl" : "border-brand-black/10 hover:border-brand-black/40",
                                                      (!date || isSlotTaken(date, t)) && "opacity-20 cursor-not-allowed bg-brand-offwhite"
                                                  )}
                                                >
                                                    <div>
                                                        <p className={cn("text-[9px] mb-1 font-bold", time === t ? "text-white/40" : "text-brand-black/30")}>
                                                            {t.includes('AM') ? 'Morning' : 'Afternoon'}
                                                        </p>
                                                        <span className="font-serif text-lg tracking-normal">{t}</span>
                                                    </div>
                                                    {isSlotTaken(date, t) ? (
                                                        <span className="text-[10px] font-bold text-brand-accent tracking-widest">BOOKED</span>
                                                    ) : (
                                                        <div className={cn(
                                                            "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                                                            time === t ? "border-brand-accent bg-brand-accent" : "border-brand-black/10"
                                                        )}>
                                                            {time === t && <Check size={10} className="text-white" />}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button 
                                  onClick={() => setStep(3)}
                                  disabled={!date || !time}
                                  className="w-full bg-brand-black text-white py-6 font-bold uppercase tracking-[0.4em] hover:bg-brand-accent disabled:bg-gray-100 disabled:text-black/20 transition-all duration-500 shadow-2xl"
                                >
                                    REVIEW RESERVATION
                                </button>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div 
                              key="step3"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="w-full"
                            >
                                <div className="max-w-xl mx-auto space-y-12">
                                    <h2 className="text-4xl md:text-5xl font-serif mb-12 tracking-tight uppercase text-center">예약 정보 입력</h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/40 block">이름</label>
                                            <input 
                                                type="text"
                                                value={userName}
                                                onChange={(e) => setUserName(e.target.value)}
                                                placeholder="성함을 입력해주세요"
                                                className="w-full border-b border-brand-black/10 py-4 text-xl font-serif focus:outline-none focus:border-brand-accent transition-all bg-transparent rounded-none"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/40 block">전화번호</label>
                                            <input 
                                                type="tel"
                                                value={userPhone}
                                                onChange={(e) => setUserPhone(e.target.value)}
                                                placeholder="010-0000-0000"
                                                className="w-full border-b border-brand-black/10 py-4 text-xl font-serif focus:outline-none focus:border-brand-accent transition-all bg-transparent rounded-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/40 block">촬영 내용 및 목적</label>
                                        <textarea 
                                            value={bookingPurpose}
                                            onChange={(e) => setBookingPurpose(e.target.value)}
                                            placeholder="원하시는 촬영 컨셉이나 목적을 작성해주세요"
                                            rows={3}
                                            className="w-full border-b border-brand-black/10 py-4 text-lg font-light focus:outline-none focus:border-brand-accent transition-all bg-transparent rounded-none resize-none"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-black/40 block">기타 문의사항</label>
                                        <textarea 
                                            value={inquiry}
                                            onChange={(e) => setInquiry(e.target.value)}
                                            placeholder="궁금하신 점이 있다면 남겨주세요"
                                            rows={3}
                                            className="w-full border-b border-brand-black/10 py-4 text-lg font-light focus:outline-none focus:border-brand-accent transition-all bg-transparent rounded-none resize-none"
                                        />
                                    </div>

                                    <div className="bg-brand-offwhite p-10 border border-brand-black/5 space-y-6">
                                        <div className="flex justify-between items-baseline border-b border-brand-black/5 pb-4">
                                            <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-brand-black/30">SELECTED SERVICE</span>
                                            <p className="text-lg font-bold uppercase tracking-tight text-brand-black">{services.find(s => s.id === service)?.title}</p>
                                        </div>
                                        <div className="flex justify-between items-baseline border-b border-brand-black/5 pb-4">
                                            <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-brand-black/30">SCHEDULE</span>
                                            <p className="text-lg font-bold uppercase tracking-tight text-brand-black">{date} <span className="text-brand-accent/60 mx-1">@</span> {time}</p>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-brand-black/30">TOTAL</span>
                                            <span className="text-3xl font-serif text-brand-accent">₩{services.find(s => s.id === service)?.price.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-6 pt-6">
                                        <button 
                                          onClick={handleBooking}
                                          disabled={isSubmitting || !userName || !userPhone}
                                          className="w-full bg-brand-black text-white py-6 font-bold uppercase tracking-[0.4em] shadow-2xl hover:bg-brand-accent transition-all duration-500 disabled:bg-gray-100 disabled:text-black/20"
                                        >
                                            {isSubmitting ? "처리 중..." : "예약 신청하기"}
                                        </button>
                                        <button onClick={() => setStep(2)} className="text-[10px] uppercase tracking-[0.3em] text-brand-black/40 hover:text-brand-black transition-colors text-center">
                                            일정 수정하기
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div 
                              key="step4"
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-center w-full py-10 flex flex-col items-center"
                            >
                                <div className="mb-12 relative">
                                    <div className="w-24 h-24 rounded-full border border-brand-accent/30 flex items-center justify-center text-brand-accent animate-pulse" />
                                    <div className="absolute inset-0 flex items-center justify-center text-brand-accent">
                                        <Check size={40} strokeWidth={1.5} />
                                    </div>
                                </div>
                                <h2 className="text-5xl font-serif mb-8 tracking-tight uppercase">Reservation Complete</h2>
                                <p className="text-brand-black/60 max-w-sm leading-[1.8] mb-16 font-light text-center break-keep">
                                    예약 신청이 정상적으로 접수되었습니다.<br />
                                    운영자 확인 후 예약 확정 안내가 전송됩니다.<br />
                                    마이페이지에서 예약 상태를 확인하실 수 있습니다.
                                </p>
                                <Link 
                                    to="/mypage" 
                                    className="bg-brand-black text-white px-16 py-6 font-bold uppercase tracking-[0.4em] hover:bg-brand-accent transition-all duration-500 shadow-2xl"
                                >
                                    마이페이지로 이동
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}


function BookingDetailModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-2xl w-full p-10 md:p-16 shadow-2xl relative border border-brand-black/5 max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-brand-black/20 hover:text-brand-black transition-colors">
          <X size={24} />
        </button>

        <div className="space-y-12">
            <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-accent mb-4 block">Reservation Detail</span>
                <h3 className="text-4xl font-serif uppercase tracking-tight leading-none mb-2">{booking.serviceTitle}</h3>
                <p className="text-brand-black/40 text-sm font-light">Reserved on {new Date(booking.createdAt).toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-y border-brand-black/5 py-10">
                <div className="space-y-6">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-brand-black/30 font-bold">Schedule</p>
                        <p className="text-xl font-serif">{booking.date} @ {booking.timeSlot}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-brand-black/30 font-bold">Status</p>
                        <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold uppercase border",
                            booking.status === 'confirmed' ? "border-green-500 text-green-500" : 
                            booking.status === 'pending' ? "border-brand-accent text-brand-accent" : "border-red-500 text-red-500"
                        )}>
                            {booking.status}
                        </span>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-brand-black/30 font-bold">Customer</p>
                        <p className="text-lg font-medium">{booking.userName}</p>
                        <div className="text-sm font-light text-brand-black/60">
                            <p>{booking.userEmail}</p>
                            <p>{booking.userPhone}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-brand-black/30 font-bold">Purpose of Shoot</p>
                    <p className="text-brand-black/80 font-light leading-relaxed whitespace-pre-wrap bg-brand-offwhite p-6 border-l-2 border-brand-accent">
                        {booking.bookingPurpose || 'N/A'}
                    </p>
                </div>
                {booking.inquiry && (
                    <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-brand-black/30 font-bold">Inquiry / Questions</p>
                        <p className="text-brand-black/80 font-light leading-relaxed whitespace-pre-wrap bg-brand-offwhite p-6 border-l-2 border-brand-black/10">
                            {booking.inquiry}
                        </p>
                    </div>
                )}
            </div>

            <div className="pt-8 flex justify-end">
                <button 
                    onClick={onClose}
                    className="px-10 py-4 bg-brand-black text-white text-xs font-bold uppercase tracking-widest hover:bg-brand-accent transition-all"
                >
                    Close Detail
                </button>
            </div>
        </div>
      </motion.div>
    </div>
  );
}


function MyPage() {
    const { user, profile, loading } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    useEffect(() => {
        if (!user) return;
        const path = 'bookings';
        const q = query(
          collection(db, path), 
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, (snap) => {
            setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Booking));
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, path);
        });
    }, [user]);

    if (loading) return null;
    if (!user) return <div className="p-24 text-center font-serif text-2xl uppercase tracking-widest">Login Required</div>;

    return (
        <div className="min-h-screen py-24 px-6 bg-brand-offwhite">
            <div className="max-w-5xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
                    <div>
                        <h1 className="text-6xl font-serif mb-4 uppercase tracking-tighter">Welcome, {profile?.displayName}</h1>
                        <p className="text-brand-black/40 font-light">{user.email}</p>
                    </div>
                    <Link to="/booking" className="bg-brand-black text-white px-8 py-4 font-bold uppercase tracking-widest text-sm self-start">
                        NEW BOOKING
                    </Link>
                </header>

                <div className="grid grid-cols-1 gap-8">
                    <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-brand-black/40">YOUR SESSIONS</h2>
                    {bookings.length === 0 ? (
                        <div className="bg-white p-20 text-center border-2 border-dashed border-brand-black/10">
                            <p className="text-brand-black/40">NO RESERVATIONS FOUND</p>
                        </div>
                    ) : (
                        bookings.map(book => (
                            <div key={book.id} className="bg-white p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 shadow-sm">
                                <div className="flex gap-10">
                                    <div className="text-center border-r pr-10">
                                        <p className="text-4xl font-serif font-black">{book.date.split('-')[2]}</p>
                                        <p className="text-xs font-bold uppercase tracking-widest opacity-40">{book.date.split('-')[1]}월</p>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold uppercase mb-2">{book.serviceTitle}</h4>
                                        <p className="text-sm font-light text-brand-black/60">{book.timeSlot}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8 w-full md:w-auto border-t md:border-t-0 pt-8 md:pt-0">
                                    <div className={cn(
                                        "px-4 py-1 text-[10px] uppercase font-bold tracking-widest border",
                                        book.status === 'confirmed' ? "border-green-500 text-green-500" : 
                                        book.status === 'pending' ? "border-brand-accent text-brand-accent" : "border-brand-black/20 text-brand-black/20"
                                    )}>
                                        {book.status === 'confirmed' ? 'CONFIRMED' : book.status === 'pending' ? 'PENDING' : 'CANCELLED'}
                                    </div>
                                    <button 
                                        onClick={() => setSelectedBooking(book)}
                                        className="text-xs font-bold uppercase tracking-widest border-b border-brand-black pb-1 ml-auto"
                                    >
                                        DETAILS
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <BookingDetailModal 
                booking={selectedBooking} 
                onClose={() => setSelectedBooking(null)} 
            />
        </div>
    )
}


function AdminAdmin() {
    const { isAdmin, loading } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    useEffect(() => {
        if (!isAdmin) return;
        const path = 'bookings';
        const q = query(collection(db, path), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Booking));
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, path);
        });
    }, [isAdmin]);

    const updateStatus = async (id: string, status: BookingStatus) => {
      const path = `bookings/${id}`;
      try {
        await updateDoc(doc(db, 'bookings', id), { status });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    if (loading) return null;
    if (!isAdmin) return <div className="p-24 text-center font-serif text-2xl uppercase">ACCESS DENIED</div>;

    return (
        <div className="min-h-screen py-24 px-6 bg-brand-black text-white">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-5xl font-serif mb-12">Studio Control Center</h1>
                
                <div className="bg-white/5 border border-white/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-white/10 uppercase text-[10px] tracking-widest text-white/40">
                            <tr>
                                <th className="p-6">DATE</th>
                                <th className="p-6">CUSTOMER</th>
                                <th className="p-6">SHOOT</th>
                                <th className="p-6">RESERVED AT</th>
                                <th className="p-6">STATUS</th>
                                <th className="p-6">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-light">
                            {bookings.map(book => (
                                <tr key={book.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-6">
                                        <p className="font-bold">{book.date}</p>
                                        <p className="text-[10px] text-white/40">{book.timeSlot}</p>
                                    </td>
                                    <td className="p-6">
                                        <p className="font-medium">{book.userName}</p>
                                        <div className="text-[10px] text-white/40 space-y-0.5">
                                            <p>{book.userEmail}</p>
                                            <p>{book.userPhone}</p>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <p className="font-medium">{book.serviceTitle}</p>
                                        <div className="text-[10px] text-white/40 mt-1 max-w-xs truncate" title={book.bookingPurpose}>
                                            {book.bookingPurpose}
                                        </div>
                                        {book.inquiry && (
                                            <div className="text-[10px] text-brand-accent mt-1 italic max-w-xs truncate" title={book.inquiry}>
                                                Q: {book.inquiry}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-6">
                                        <p className="text-[10px]">{new Date(book.createdAt).toLocaleDateString()}</p>
                                        <p className="text-[10px] text-white/40">{new Date(book.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </td>
                                    <td className="p-6">
                                        <span className={cn(
                                            "text-[10px] px-2 py-1 border font-bold uppercase",
                                            book.status === 'confirmed' ? "border-green-500 text-green-500" :
                                            book.status === 'pending' ? "border-brand-accent text-brand-accent" : "border-red-500 text-red-500"
                                        )}>
                                            {book.status === 'confirmed' ? 'CONFIRMED' : book.status === 'pending' ? 'PENDING' : 'CANCELLED'}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col gap-2">
                                            <button 
                                                onClick={() => setSelectedBooking(book)}
                                                className="text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:underline text-left"
                                            >
                                                DETAIL
                                            </button>
                                            <div className="flex gap-4">
                                                {book.status === 'pending' && (
                                                    <button onClick={() => updateStatus(book.id, 'confirmed')} className="text-green-500 hover:underline">CONFIRM</button>
                                                )}
                                                <button onClick={() => updateStatus(book.id, 'cancelled')} className="text-red-500 hover:underline">CANCEL</button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <BookingDetailModal 
                booking={selectedBooking} 
                onClose={() => setSelectedBooking(null)} 
            />
        </div>
    )
}

function Main() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-white">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/admin" element={<AdminAdmin />} />
            </Routes>
          </main>
          <Footer />
          
          {/* Global Sticky Booking Button for Mobile */}
          <Link to="/booking" className="md:hidden fixed bottom-6 right-6 z-50 bg-brand-accent text-white p-5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all">
            <Calendar size={28} />
          </Link>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default Main;
