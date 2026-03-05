export interface InventoryProduct {
    id: string;
    name: string;
    code: string;
    type?: number;
    categoryId?: number;
    price: number;
    deletedPrice: number;
    resources?: string | null;
    quantity: number;
    availabilitTypeId: number;
    createdOn: string;
    isPublished: boolean;
    tags: string[];
}

export interface InventoryPagination {
    length: number;
    size: number;
    page: number;
    lastPage: number;
    startIndex: number;
    endIndex: number;
}

export interface InventoryCategory {
    id: string;
    parentId: string;
    name: string;
    slug: string;
}

export interface InventoryBrand {
    id: string;
    name: string;
    slug: string;
}

export interface InventoryTag {
    id?: string;
    title?: string;
}

export interface InventoryVendor {
    id: string;
    name: string;
    slug: string;
}
