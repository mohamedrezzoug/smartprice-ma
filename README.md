# SmartPrice MA — MVP جاهز للتشغيل

تطبيق ويب تقدمي (PWA) لمقارنة أثمنة المشتريات في المغرب، بواجهة عربية RTL وفرنسية، ويعمل دون اتصال بعد أول تحميل.

## مهم قبل الاستعمال
الأسعار الموجودة في `src/data.ts` **بيانات تجريبية توضيحية** وليست أسعاراً حقيقية أو عروضاً مؤكدة. لا تنشر التطبيق على أنه يعرض أسعاراً مباشرة قبل ربط مصادر بيانات موثوقة والتحقق من الأسعار.

## الوظائف الموجودة
- البحث باسم المنتج أو الباركود (بحث نصي).
- تصنيف المنتجات.
- مقارنة السعر بين المتاجر.
- إنشاء قفة مشتريات وتحديد الكميات.
- مقارنة تكلفة القفة في كل متجر، وحساب خيار شراء كل منتج من أرخص متجر.
- تغيير المدينة واللغة (العربية/الفرنسية).
- لوحة إدارة لإضافة/تعديل سعر منتج.
- استيراد وتصدير CSV.
- حفظ البيانات والقفة محلياً عبر LocalStorage.
- PWA مع Service Worker للتشغيل الأساسي دون إنترنت.
- تصميم متجاوب للهاتف والكمبيوتر.

## التشغيل على Mac M2 / VS Code
1. ثبّت Node.js إصدار LTS من https://nodejs.org
2. فك ضغط `SmartPriceMA.zip`.
3. افتح المجلد `SmartPriceMA` في VS Code.
4. افتح Terminal داخل VS Code.
5. نفّذ:

```bash
npm install
npm run dev
```

6. افتح الرابط الذي يظهر، غالباً `http://localhost:5173`.

## بناء نسخة الإنتاج والاختبار
```bash
npm run build
npm run test
npm run preview
```

## شكل ملف CSV للاستيراد
الأعمدة (الأعمدة الثلاثة الأخيرة اختيارية):
`product_id,name_ar,name_fr,category,unit,store_id,price_mad,city,area,updated_at,status`

- `city`: معرّف المدينة (`casablanca`, `rabat`…) أو اسمها بالعربية/الفرنسية. **السطر الذي لا يمكن تحديد مدينته يُتجاهل** (لا نخمّن المدينة).
- `area`: معرّف الحي (مثلاً `casablanca:maarif`) أو اسمه. فارغ = المدينة كاملة.
- `updated_at`: تاريخ الرصد (ISO). فارغ = تاريخ الاستيراد.
- `status`: `verified` أو `user` (مساهمة غير موثقة). الثمن الأقدم من 30 يوماً يظهر «قديم».

مثال:
```csv
product_id,name_ar,name_fr,category,unit,store_id,price_mad,city,area,updated_at,status
p1,زيت المائدة 1 لتر,Huile de table 1 L,grocery,1 L,aswak,17.25,casablanca,casablanca:maarif,2026-11-08,verified
```

الصيغة القديمة (8 أعمدة) ما زالت مقبولة. أسماء المتاجر المعتمدة حالياً:
`aswak,marjane,carrefour,bim,atacadao,kazyon`

## نظام الموقع
- **اختيار يدوي**: بحث بالعربية أو الفرنسية في مدن الجهات الـ12، مع اختيار الحي (أو «جميع الأحياء»).
- **GPS**: لا يُطلب الإذن إلا عند الضغط على «تحديد موقعي». يتطلب HTTPS أو localhost. تُرسل الإحداثيات إلى Nominatim (OpenStreetMap) لمعرفة المدينة والحي والعنوان. عند انقطاع الإنترنت تُقدَّر أقرب مدينة محلياً.
- **الخصوصية**: الإحداثيات لا تُحفظ إلا إذا وافق المستخدم («تذكر موقع GPS»). المدينة والحي فقط يُحفظان. Service Worker لا يخزّن طلبات الموقع أو الخرائط. لا تُكتب الإحداثيات في السجلات.
- **المتاجر القريبة**: بحث عن السوبرماركت الحقيقية عبر Overpass (OpenStreetMap) بإحداثيات مقرّبة (~100 م)، مع فلاتر 2/5/10/20 كم وخريطة Leaflet. المسافة تُحسب فقط للمتاجر ذات إحداثيات حقيقية؛ لا توجد إحداثيات أو عناوين مخترعة في البيانات التجريبية. يمكن إضافة فروع بعناوين/إحداثيات موثوقة من لوحة الإدارة.
- **مقارنة الأثمنة**: كل ثمن مرتبط بمدينة (واختيارياً بحي). لا تُخلط أثمنة المدن. القفة تُعرض في قسمين: متاجر بالقفة كاملة، ومتاجر بتوفر جزئي مع المنتجات الناقصة.

## الإعدادات (اختيارية)
انسخ `.env.example` إلى `.env.local` لتغيير مزودي الخدمة (كلها مجانية وبدون مفتاح افتراضياً):
`VITE_GEOCODER_PROVIDER`, `VITE_GEOCODER_URL`, `VITE_PLACES_PROVIDER`, `VITE_OVERPASS_URL`, `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION`, `VITE_PRICE_OUTDATED_DAYS`, `VITE_GPS_TIMEOUT_MS`.

خدمات OpenStreetMap العامة لها سياسات استعمال (حد أقصى تقريباً طلب واحد في الثانية لـ Nominatim، ومنع الاستعمال المكثف لخوادم الخرائط). للإنتاج التجاري استعمل خادماً خاصاً أو مزوداً تجارياً أو Proxy خلفي.

## ما يلزم قبل الإطلاق التجاري
- قاعدة بيانات وخادم API (مثلاً Supabase) ومصادقة للمشرفين.
- مصادر أسعار قانونية ومستقرة: اتفاقيات مع المتاجر أو كتالوجات رسمية أو مساهمات المستخدمين بعد التحقق.
- حفظ مصدر كل سعر وتاريخ الرصد والمدينة/الفرع وحالة التحقق.
- عدم اعتبار اختلاف الحجم أو العلامة التجارية نفس المنتج.
- كاميرا لمسح الباركود (يمكن إضافتها في مرحلة تالية).
- سياسة خصوصية وشروط استخدام وآلية تبليغ عن الأسعار الخاطئة.

## بنية المشروع
- `src/App.tsx`: الواجهة الرئيسية والتبويبات.
- `src/data.ts`: المتاجر والمنتجات والأثمنة التجريبية حسب المدينة.
- `src/pricing.ts`: محرك الأثمنة حسب المدينة/الحي، مقارنة القفة، CSV.
- `src/catalog.ts`: الحفظ المحلي وترحيل البيانات القديمة.
- `src/config.ts`: إعدادات مزودي الموقع والخرائط.
- `src/location/`: الجهات والمدن والأحياء، GPS، مزودو الخدمة، حالة الموقع المركزية.
- `src/components/`: نافذة الموقع، القائمة القابلة للبحث، المتاجر القريبة، الخريطة.
- `src/illustrations.tsx`: الرسومات ثلاثية الأبعاد.
- `src/style.css`: التصميم.
- `public/sw.js`: التخزين المؤقت للعمل دون اتصال.
- `public/manifest.webmanifest`: إعدادات تثبيت PWA.
- الاختبارات: `src/logic.test.ts`, `src/location/location.test.ts`, `src/ui.test.tsx`.

## v1.1 — Scan, alerts, sync, install

- **Barcode scan**: button in the hero search (camera; needs HTTPS or localhost; manual entry fallback). Native `BarcodeDetector` when available, `@zxing/browser` otherwise.
- **Price alerts**: bell in the header. One notification per batch of price changes (CSV import, admin edit, sync); a price that went down is flagged as an offer.
- **Offline + sync**: edits are queued in `sp-outbox-v1` and pushed when the network returns. Set `VITE_API_URL` to enable a server (`POST /prices/batch` `{records}`, `GET /prices` → `PriceRecord[]`; newest `updatedAt` wins). Without it, data stays on the device.
- **Install**: PNG + maskable icons, manifest, 3D splash screen. The service worker is registered only in production builds: test offline with `npm run build && npm run preview`.
