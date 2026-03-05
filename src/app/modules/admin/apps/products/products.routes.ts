import { ProductDetailsComponent } from "./details/product-details.component";
import { ProductsListComponent } from "./products-list.component";


// src/app/app.routes.ts (or feature routes)
export default [
    { path: '', component: ProductsListComponent },
    { path: ':id', component: ProductDetailsComponent },
];
