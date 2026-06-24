export type UserRole = 'guest' | 'superadmin' | 'owner' | 'manager' | 'chef' | 'waiter' | 'courier' | 'accountant' | 'analyst';

export interface DeliveryAddress {
  id: number; label: string; city: string; street: string; house: string;
  apartment?: string; entrance?: string; floor?: string; intercom?: string;
  comment?: string; isDefault?: boolean;
}

export interface RegisteredUser {
  id: number; name: string; phone: string; email?: string; birthday?: string;
  registeredAt: string; source: 'telegram' | 'mobile_app' | 'website';
  bonusBalance?: number; totalSpent?: number; visitsCount?: number; lastVisitAt?: string;
  loyaltyLevel?: 'новичок' | 'серебро' | 'золото' | 'платина'; addresses?: DeliveryAddress[]; verifiedPhone?: boolean;
}

export interface ClientChatMessage {
  id: number; fromAdmin: boolean; text: string; timestamp: string; isRead: boolean;
}

export type NotifType = 'order' | 'booking' | 'client' | 'stock' | 'review' | 'system';
export interface Notification {
  id: string; type: NotifType; title: string; body: string; timestamp: string; isRead: boolean; link?: string; meta?: Record<string, string | number>;
}

export interface Branch {
  id: number; name: string; address: string; phone: string; lat: number; lng: number;
  workingHours: { [day: string]: { open: string; close: string } }; isActive: boolean;
}

export interface MenuCategory { id: number; name: string; icon: string; parentId?: number; order: number; branchId?: number; }
export interface Allergen { id: number; name: string; icon: string; }

export interface Dish {
  id: number; name: string; description: string; price: number; oldPrice?: number; imageUrl: string;
  categoryId: number; weight: number; calories: number; proteins: number; fats: number; carbs: number;
  allergens: string[]; tags: string[]; isAvailable: boolean; isNew: boolean; isPopular: boolean;
  branchId?: number; ingredients?: DishIngredient[]; customizations?: Customization[]; rating: number; reviewCount: number;
}
export interface DishIngredient { id: number; ingredientId: number; name: string; quantity: number; unit: string; isOptional: boolean; extraPrice: number; }
export interface Customization { id: number; name: string; options: CustomizationOption[]; required: boolean; multiple: boolean; }
export interface CustomizationOption { id: number; name: string; price: number; isDefault: boolean; }

export interface CartItem { dish: Dish; quantity: number; selectedOptions: { [customizationId: number]: number[] }; totalPrice: number; comment?: string; }

export type OrderType = 'delivery' | 'pickup' | 'dine_in';
export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'closed' | 'assigned' | 'en_route' | 'delivered' | 'cancelled';
export const STATUS_CHAIN: Record<OrderStatus, { label: string; next: OrderStatus[]; prev: OrderStatus[] }> = {
  new:        { label: 'Новый',             next: ['confirmed', 'cancelled'],            prev: [] },
  confirmed:  { label: 'Принят',            next: ['preparing', 'cancelled'],            prev: ['new'] },
  preparing:  { label: 'Готовится',         next: ['ready', 'cancelled'],                prev: ['confirmed'] },
  ready:      { label: 'Готов к выдаче',    next: ['served', 'assigned', 'cancelled'],  prev: ['preparing'] },
  served:     { label: 'Подан',             next: ['paid', 'cancelled'],                prev: ['ready'] },
  paid:       { label: 'Оплачен',           next: ['closed', 'cancelled'],              prev: ['served'] },
  closed:     { label: 'Закрыт',            next: [],                                   prev: ['paid'] },
  assigned:   { label: 'Назначен курьеру',  next: ['en_route', 'cancelled'],             prev: ['ready'] },
  en_route:   { label: 'В пути',            next: ['delivered', 'cancelled'],            prev: ['assigned'] },
  delivered:  { label: 'Выполнен',          next: [],                                    prev: ['en_route'] },
  cancelled:  { label: 'Отменён',           next: [],                                    prev: ['new', 'confirmed', 'preparing', 'ready', 'served', 'assigned', 'en_route'] },
};
export type PaymentMethod = 'telegram_stars' | 'yookassa' | 'tinkoff' | 'cash' | 'card';

export interface Order {
  id: number; userId: number; userName: string; userPhone: string; branchId: number; branchName: string;
  type: OrderType; status: OrderStatus; items: OrderItem[]; subtotal: number; deliveryFee: number; discount: number; bonusUsed: number; total: number;
  promoCode?: string; paymentMethod: PaymentMethod; isPaid: boolean; address?: string; deliveryTime?: string; tableNumber?: number;
  courierId?: number; courierName?: string; assignedBy?: number; assignedAt?: string; pickupCode?: string; courierLat?: number; courierLng?: number;
  courierPhone?: string; comment?: string; waiterId?: number; waiterName?: string; guestCount?: number;
  isReturning?: number; returnDistanceKm?: number; returnDurationMin?: number; returnEta?: string; returnCourierLat?: number; returnCourierLng?: number; returnRoutePolyline?: string;
  statusHistory?: { status: OrderStatus; at: string; note?: string }[]; createdAt: string; updatedAt: string;
}
export interface OrderItem { dishId: number; name: string; price: number; quantity: number; options: string[]; itemStatus?: ItemStatus; startedAt?: string; completedAt?: string; }

export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served';
export interface OrderItemStatus {
  id: number; orderId: number; dishId: number; status: ItemStatus;
  startedAt?: string; completedAt?: string; preparedBy?: number; note?: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export interface Booking { id: number; userId: number; userName: string; userPhone: string; branchId: number; date: string; time: string; duration: number; guestCount: number; tableId: number; tableName: string; status: BookingStatus; deposit: number; comment?: string; createdAt: string; }
export interface Table { id: number; branchId: number; name: string; capacity: number; zone: string; x: number; y: number; width?: number; height?: number; shape?: string; color?: string; status: 'free' | 'reserved' | 'occupied'; currentOrderId?: number; }

export interface WaiterCall { id: number; tableId: number; tableName: string; createdAt: string; resolvedAt?: string; resolvedBy?: number; }

export interface DineInCheck {
  id: number; tableId: number; tableName: string; waiterId: number; waiterName: string;
  guestCount: number; status: 'open' | 'closed';
  orders: Order[]; total: number; createdAt: string; updatedAt: string;
}

export interface Ingredient { id: number; name: string; unit: string; pricePerUnit: number; currentStock: number; minStock: number; supplierId?: number; expiryDate?: string; branchId: number; }
export interface Supplier { id: number; name: string; contactPerson: string; phone: string; email: string; address: string; }
export interface PurchaseOrderItem { ingredientId: number; name: string; quantity: number; unit: string; pricePerUnit: number; total: number; }
export interface PurchaseOrder { id: number; supplierId: number; supplierName: string; branchId: number; branchName: string; items: PurchaseOrderItem[]; total: number; status: 'draft' | 'sent' | 'delivered' | 'cancelled'; notes: string; createdBy: string; createdAt: string; updatedAt: string; }

export interface PromoCode { id: number; code: string; type: 'percent' | 'fixed'; value: number; minOrder: number; maxUses: number; usedCount: number; expiresAt: string; branchId?: number; dishId?: number; isActive: boolean; }
export interface Staff { id: number; telegramId: number; firstName: string; lastName: string; role: UserRole; branchId: number; branchName: string; phone: string; hourlyRate: number; isActive: boolean; kpiScore: number; ordersHandled: number; avgRating: number; }

export type ReviewSource = 'mobile_app' | 'website' | 'telegram';
export interface Review { id: number; userId: number; userName: string; userAvatar?: string; dishId: number; dishName: string; branchId?: number; branchName?: string; rating: number; text: string; photoUrl?: string; isModerated: boolean; isVisible: boolean; reply?: string; source: ReviewSource; createdAt: string; }

export interface PickupPointPhoto { id: number; url: string; name: string; isMain: boolean; order: number; }
export interface PickupPointWorkingHours { [day: string]: { open: string; close: string; isClosed?: boolean }; }
export interface PickupPoint { id: number; name: string; address: string; lat: number; lng: number; phone?: string; description?: string; workingHours: PickupPointWorkingHours; photos: PickupPointPhoto[]; rating: number; reviewCount: number; estimatedReadyMinutes: number; isActive: boolean; displayOrder: number; createdAt: string; updatedAt: string; }
export interface PickupPointReview { id: number; pickupPointId: number; userId: number; userName: string; rating: number; text: string; source: ReviewSource; isModerated: boolean; isVisible: boolean; reply?: string; createdAt: string; }

export interface Shift {
  id: number; staffId: number; staffName: string; date: string; startTime: string; endTime: string; branchId: number; isConfirmed: boolean;
}

export interface SalaryRecord {
  id: number;
  staffId: number;
  firstName: string;
  lastName: string;
  role: string;
  position: string;
  month: number;
  year: number;
  accruedAmount: number;
  paidAmount: number;
  paidDate: string | null;
  paymentMethod: string;
  note: string | null;
  details: string;
  status: 'calculated' | 'paid' | 'partial';
  calculatedAt: string;
  paidAt: string | null;
}

export interface SalaryLog {
  id: number;
  staffId: number;
  action: string;
  amount: number;
  detail: string;
  createdAt: string;
}

export interface SalaryReport {
  totalAccrued: number;
  totalPaid: number;
  byRole: { role: string; count: number; total: number; avg: number }[];
  topEarners: { staffId: number; firstName: string; lastName: string; role: string; accruedAmount: number }[];
  monthlyTrend: { month: number; year: number; total: number }[];
}
export interface AuditLog { id: number; userId: number; userName: string; action: string; details: string; ip?: string; createdAt: string; }
export interface DeliveryZone { id: number; branchId: number; name: string; radiusKm: number; minOrder: number; deliveryPrice: number; estimatedTime: number; }
export interface Campaign { id: number; name: string; type: 'manual' | 'trigger'; triggerType?: 'inactive' | 'birthday' | 'after_review'; message: string; buttonText?: string; sentCount: number; openCount: number; status: 'draft' | 'active' | 'completed'; createdAt: string; }

export interface PaymentMethodSetting {
  id: number;
  name: string;
  key: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export type GuestPage = 'home' | 'menu' | 'dish' | 'cart' | 'checkout' | 'booking' | 'profile' | 'orders' | 'loyalty' | 'reviews' | 'support' | 'order-tracking' | 'favorites' | 'addresses' | 'support-chat' | 'repeat-order' | 'mini-game' | 'coupons' | 'settings' | 'order-checklist' | 'payment' | 'payment-success' | 'courier-chat' | 'qr-payment' | 'qr-menu' | 'games';
export type AdminPage = 'dashboard' | 'orders' | 'categories' | 'menu' | 'tech_cards' | 'bookings' | 'inventory' | 'inventory_items' | 'stock_categories' | 'warehouses' | 'workshops' | 'counterparties' | 'wholesale_prices' | 'delivery' | 'finance' | 'marketing' | 'staff' | 'settings' | 'audit' | 'kitchen' | 'reviews' | 'clients' | 'client_groups' | 'branches' | 'review_questions' | 'pickup_points' | 'courier' | 'payment_settings' | 'salary' | 'documents' | 'menu_items' | 'menu_categories' | 'menu_modifiers' | 'menu_modifier_groups' | 'menu_price_lists' | 'menu_weekly_menu' | 'menu_stop_lists' | 'menu_languages' | 'messages' | 'notifications' | 'push_settings' | 'aggregators' | 'payments' | 'theme_constructor' | 'security' | 'forecast' | 'reports' | 'app_management' | 'chats' | 'staff_chats' | 'loyalty' | 'integration_1c' | 'fiscalization' | 'terminal' | 'auto_orders' | 'shifts' | 'auto_writeoff' | 'costing' | 'email_settings' | 'bank_statement' | 'staff_schedule' | 'crm_integration' | 'tax_accounting' | 'balance_sheet' | 'supplier_portal' | 'telegram_bot' | 'branding' | 'site_settings' | 'courier_guest_chats' | 'barcodes' | 'swagger_docs' | 'franchising' | 'yandex_afisha' | 'foh_display' | 'honest_sign' | 'extensions' | 'telephony' | 'telephony_operator' | 'extensions_sdk' | 'gamification' | 'currency_settings' | 'yuma_import' | 'profile';

export interface ChatInfo {
  id: number;
  tenantId: number;
  guestId: number;
  guestName: string;
  guestPhone: string;
  orderId: number;
  tableId: number;
  status: string;
  assignedWaiterId: number;
  assignedWaiterName: string;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
}

export interface ChatMessage {
  id: number;
  chatId: number;
  senderType: 'guest' | 'waiter' | 'admin';
  senderId: number;
  senderName: string;
  message: string;
  fileUrl: string;
  isRead: boolean;
  createdAt: string;
}

export interface StaffChat {
  id: number;
  tenantId: number;
  orderId: number;
  courierId: number;
  courierName: string;
  waiterId: number;
  waiterName: string;
  status: string;
  isImportant: boolean;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  orderNumber?: number;
}

export interface StaffChatMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderType: 'courier' | 'waiter';
  senderName: string;
  message: string;
  fileUrl: string;
  messageType: 'text' | 'location';
  locationData?: { lat: number; lng: number; address?: string };
  isRead: boolean;
  createdAt: string;
}

export interface SavedAddress {
  id: number;
  label: 'Дом' | 'Работа' | 'Другое';
  address: string;
  apartment?: string;
  entrance?: string;
  comment?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export interface SupportMessage {
  id: number;
  fromUser: boolean;
  text: string;
  timestamp: string;
  isRead: boolean;
  fileUrl?: string;
}

export interface Coupon {
  id: number;
  title: string;
  description: string;
  code: string;
  discount: string;
  expiresAt: string;
  isUsed: boolean;
  color: string;
}

export interface GameScore {
  score: number;
  date: string;
}

export interface UserSettings {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  avatar: string;
  notificationsEnabled: boolean;
  smsEnabled: boolean;
}

export type AggregatorProvider = 'yandex' | 'delivery_club' | 'sbermarket';

export interface AggregatorSetting {
  provider: AggregatorProvider;
  name: string;
  logo: string;
  enabled: boolean;
  credentials: Record<string, string>;
  lastSyncAt: string | null;
  lastMenuSyncAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AggregatorSyncLogItem {
  id: number;
  tenantId: number;
  provider: string;
  operation: string;
  request: string;
  response: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AggregatorSyncLogResponse {
  items: AggregatorSyncLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaymentProvider = 'yookassa' | 'cloudpayments' | 'tbank';
export type PaymentStatus = 'pending' | 'succeeded' | 'canceled' | 'refunded' | 'error';
export type PaymentMethodType = 'card' | 'sbp' | 'apple_pay' | 'google_pay';

export interface Payment {
  id: string;
  tenantId: number;
  orderId: number | null;
  subscriptionId: number | null;
  externalPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  provider: PaymentProvider;
  metadata: any;
  description: string;
  returnUrl: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  orderUserName?: string;
  orderTotal?: number;
}

export interface PaymentSettings {
  id: number;
  provider: string;
  enabled: boolean;
  credentials: Record<string, string>;
  testMode: boolean;
}

export interface PaymentCreateResult {
  ok: boolean;
  paymentId: string;
  externalPaymentId: string;
  confirmationUrl: string;
  status: string;
  error: string | null;
}

export interface Tariff {
  id: number;
  name: string;
  price: number;
  period: 'month' | 'year';
  description: string;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface Subscription {
  id: number;
  tenantId: number;
  tariffId: number;
  tariffName?: string;
  tariffPrice?: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'canceled';
  autoRenew: boolean;
  paymentId: string | null;
  createdAt: string;
}

export interface BarcodeItem {
  id: number;
  name: string;
  barcode: string;
  article?: string;
  unit?: string;
  type: 'inventory' | 'dish';
}
export interface BarcodeGenerateResult {
  barcode: string;
  type: 'ean13';
}
export interface BarcodePrintItem {
  id: number;
  name: string;
  barcode: string;
  unit?: string;
}

export type GameType = 'wheel_of_fortune' | 'quiz' | 'challenge';
export interface Game {
  id: number;
  tenant_id: number;
  type: GameType;
  name: string;
  description: string;
  settings: string;
  prize_description: string;
  cooldown_hours: number;
  enabled: number;
  created_at: string;
}
export interface GameParticipation {
  id: number;
  guest_id: number;
  game_id: number;
  game_type: GameType;
  result: string;
  points: number;
  prize: string;
  created_at: string;
}
export interface GuestAchievement {
  id: number;
  guest_id: number;
  title: string;
  description: string;
  icon: string;
  progress: number;
  max_progress: number;
  completed: number;
  created_at: string;
}

export interface ExchangeRate {
  id: number;
  currency_code: string;
  name: string;
  symbol: string;
  rate: number;
  is_base: number;
  updated_at: string;
}

export interface TelephonyOperatorCall {
  id: number;
  tenant_id: number;
  call_id: string;
  caller_phone: string;
  callee_phone: string;
  client_name: string;
  client_id: number;
  order_id: number;
  status: string;
  notes: string;
  duration: number;
  created_at: string;
}

export interface ExtensionHook {
  id: number;
  extension_id: number;
  event: string;
  endpoint: string;
  created_at: string;
}
