export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface PhotographyService {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: number;
  category: 'profile' | 'body' | 'concept' | 'natural' | 'rgb';
  imageUrl: string;
}

export interface Booking {
  id: string;
  userId: string;
  serviceId: string;
  date: string;
  timeSlot: string;
  status: BookingStatus;
  userEmail: string;
  userName: string;
  userPhone: string;
  bookingPurpose: string;
  inquiry: string;
  notes?: string;
  createdAt: string;
  finishedPhotoUrl?: string;
  serviceTitle?: string; // Denormalized for convenience
}

export interface PortfolioItem {
  id: string;
  category: string;
  imageUrl: string;
  title: string;
}
