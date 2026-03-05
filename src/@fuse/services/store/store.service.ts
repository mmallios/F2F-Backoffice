// src/app/services/store-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';


/** Keep in sync with your backend enum */
export type ProductSize = number; // or 'S' | 'M' | 'L' if you later change backend

export interface ProductSKU {
    size: ProductSize;
    stock: number;
}

export interface ProductDto {
    id: number;
    code: string;
    title: string;
    smallDescription?: string | null;
    description?: string | null;
    price: number;
    deletedPrice: number;
    stock: number;
    imageUrl?: string | null;
    maxQuantity: number;
    isPublished: boolean;
    skUs: ProductSKU[];      // NOTE: backend property is "SKUs". Most .NET JSON serializers output "skUs" or "skus" depending on policy.
    categoryIds: number[];
}

export interface CreateProductRequest {
    code: string;
    title: string;
    smallDescription?: string | null;
    description?: string | null;
    price: number;
    deletedPrice: number;
    stock?: number;
    imageUrl?: string | null;
    maxQuantity?: number;
    isPublished?: boolean;
    skUs?: string | null;     // backend uses string? SKUs (json)
    categoryIds: number[];
}

export interface UpdateProductRequest {
    code: string;
    title: string;
    smallDescription?: string | null;
    description?: string | null;
    price: number;
    deletedPrice: number;
    stock: number;
    imageUrl?: string | null;
    maxQuantity: number;
    isPublished: boolean;
    skUs?: string | null;     // backend uses string? SKUs (json)
    categoryIds: number[];
}

export interface CreateCategoryRequest {
    title: string;
    code: string;
}

/** Your backend didn't include the DTO type; keep it generic but useful */
export interface CategoryDto {
    id: number;
    title: string;
    code: string;
}

export interface AddToCartRequest {
    productId: number;
    quantity?: number;
    size?: ProductSize | null;
}

export interface CartItemDto {
    id: number;
    productId: number;
    productTitle: string;
    imageUrl?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    size?: ProductSize | null;
}

export interface CartDto {
    id: number;
    userId: number;
    items: CartItemDto[];
    total: number;
}

export interface CreateOrderRequest {
    userId: number;
    cartId: number;
    totalAmount: number;
    shippingAmount?: number | null;
    shippingMethod?: number | null; // enum int
    paymentMethod?: number | null;  // enum int
    orderData?: string | null;      // JSON string
}

// src/app/services/store/store.models.ts
// All interfaces aligned with your C# entities (Order, Cart, CartItem, CommonEntity)
// plus a minimal Product/User shape used by Order->Cart->Items.

export interface CommonEntity {
    id: number;
    createdOn: string; // ISO
    updatedOn?: string | null;
}

// Minimal user shape (Order includes User navigation)
export interface UserMini extends CommonEntity {
    firstname?: string | null;
    lastname?: string | null;
    email?: string | null;
    code?: string | null;
    image?: string | null;
}

// Minimal product shape (CartItem includes Product navigation)
export interface ProductMini extends CommonEntity {
    code: string;
    title: string;
    imageUrl?: string | null;
    price: number;
}

// CartItem entity (NOTE: your C# CartItem mistakenly has ICollection<CartItem> Items; do NOT model that in TS)
export interface CartItem extends CommonEntity {
    cartId: number;
    productId: number;

    product: ProductMini;

    quantity: number;
    unitPrice: number;
    size?: number | null; // ProductSize enum (int) in backend
}

// Cart entity
export interface Cart extends CommonEntity {
    userId: number;
    user?: UserMini; // navigation exists in C# Cart
    isCheckedOut: boolean;

    items: CartItem[];
}

// Order entity (FULL)
export interface Order extends CommonEntity {
    code: string;

    userId: number;
    user?: UserMini; // navigation

    cartId: number;
    cart: Cart; // navigation

    totalAmount: number;
    shippingAmount?: number | null;

    shippingMethod?: number | null; // ShippingMethod enum int
    paymentMethod?: number | null;  // PaymentMethod enum int
    status: number;                 // OrderStatus enum int

    submittedAt: string;            // ISO
    orderData?: string | null;      // JSON string
}

// Optional: lightweight list DTO for orders table (recommended)
export interface OrderListItem {
    id: number;
    code: string;
    userId: number;

    submittedAt: string;
    totalAmount: number;
    shippingAmount?: number | null;

    shippingMethod?: number | null;
    paymentMethod?: number | null;
    status: number;
}

export interface OrderDetailsResponse {
    id: number;
    code: string;
    submittedAt: string; // ISO string
    totalAmount: number;
    shippingAmount?: number | null;
    status: number;
    shippingMethod?: number | null;
    paymentMethod?: number | null;
    orderData?: string | null;
    items: CartItemDto[];
}

@Injectable({ providedIn: 'root' })
export class StoreService {
    private readonly base = `${environment.apiUrl}/store`;

    constructor(private http: HttpClient) { }

    // =========================
    // PRODUCTS
    // =========================

    getAllProducts(): Observable<ProductDto[]> {
        return this.http.get<ProductDto[]>(`${this.base}`);
    }

    getProductById(id: number): Observable<ProductDto> {
        return this.http.get<ProductDto>(`${this.base}/${id}`);
    }

    getProductByCode(productCode: string): Observable<ProductDto> {
        return this.http.get<ProductDto>(`${this.base}/products/${encodeURIComponent(productCode)}`);
    }

    createProduct(payload: CreateProductRequest): Observable<ProductDto> {
        return this.http.post<ProductDto>(`${this.base}`, payload);
    }

    updateProduct(id: number, payload: UpdateProductRequest): Observable<ProductDto> {
        return this.http.put<ProductDto>(`${this.base}/${id}`, payload);
    }

    deleteProduct(id: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }

    // =========================
    // CATEGORIES
    // =========================

    getAllCategories(): Observable<CategoryDto[]> {
        return this.http.get<CategoryDto[]>(`${this.base}/categories`);
    }

    getProductsByCategory(categoryId: number): Observable<ProductDto[]> {
        return this.http.get<ProductDto[]>(`${this.base}/categories/${categoryId}/products`);
    }

    addCategory(payload: CreateCategoryRequest): Observable<CategoryDto> {
        return this.http.post<CategoryDto>(`${this.base}/categories`, payload);
    }

    removeProductFromCategory(categoryId: number, productId: number): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(
            `${this.base}/categories/${categoryId}/product/${productId}`
        );
    }

    // =========================
    // CART
    // =========================

    getCart(userId: number): Observable<CartDto> {
        return this.http.get<CartDto>(`${this.base}/cart/${userId}`);
    }

    addToCart(userId: number, payload: AddToCartRequest): Observable<CartDto> {
        return this.http.post<CartDto>(`${this.base}/cart/${userId}/items`, payload);
    }

    removeFromCart(userId: number, cartItemId: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/cart/${userId}/items/${cartItemId}`);
    }

    deleteCart(userId: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/cart/${userId}`);
    }

    // =========================
    // ORDERS
    // =========================

    createNewOrder(payload: CreateOrderRequest): Observable<Order> {
        return this.http.post<Order>(`${this.base}/orders`, payload);
    }

    getOrders(): Observable<Order[]> {
        return this.http.get<Order[]>(`${this.base}/orders`);
    }

    getOrderByCode(code: string): Observable<OrderDetailsResponse> {
        return this.http.get<OrderDetailsResponse>(`${this.base}/orders/${encodeURIComponent(code)}`);
    }
}
