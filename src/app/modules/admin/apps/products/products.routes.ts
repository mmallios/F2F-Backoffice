import { ProductCategoriesComponent } from "./categories/product-categories.component";
import { ProductDetailsComponent } from "./details/product-details.component";
import { ProductsListComponent } from "./products-list.component";

// src/app/app.routes.ts (or feature routes)
export default [
    { path: '', component: ProductsListComponent },
    { path: 'categories', component: ProductCategoriesComponent },
    { path: ':id', component: ProductDetailsComponent },
];
