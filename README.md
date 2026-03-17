# IST Valuation Platform

> منصة متكاملة لتقييم العقارات في الوقت الفعلي، تتيح للمطورين العقاريين والوكلاء توليد تقييمات فورية مبنية على بيانات السوق الفعلية (قوائم البيع وسجلات DLD)، مع لوحة إدارة احترافية وتقارير PDF.

---

## المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [المكدس التقني](#المكدس-التقني)
3. [هيكل قاعدة البيانات](#هيكل-قاعدة-البيانات)
4. [محرك التقييم — المعادلات الرياضية](#محرك-التقييم--المعادلات-الرياضية)
5. [تدفق التقييم الكامل](#تدفق-التقييم-الكامل)
6. [الأدوار والصلاحيات RBAC](#الأدوار-والصلاحيات-rbac)
7. [روابط التقييم](#روابط-التقييم)
8. [توليد تقارير PDF](#توليد-تقارير-pdf)
9. [واجهات API الكاملة](#واجهات-api-الكاملة)
10. [لوحة الإدارة](#لوحة-الإدارة)
11. [متغيرات البيئة](#متغيرات-البيئة)
12. [التثبيت والتشغيل](#التثبيت-والتشغيل)
13. [بنية الملفات](#بنية-الملفات)

---

## نظرة عامة

تعمل المنصة على نموذج ثلاثي المراحل:

```
العميل ← رابط تقييم عام → يملأ نموذج → يحصل على نتيجة فورية + تقرير PDF
المدير ← لوحة إدارة → يتابع العملاء المحتملين (Leads) → يصدر تقارير
```

**المزايا الجوهرية:**
- تقييم مزدوج: منطقة جغرافية + مشروع محدد
- تقييم يدوي من المختص كطبقة ثالثة
- محرك مقارنات ذكي مع إزالة الشواذ
- درجة ثقة مبنية على حجم البيانات وتباينها وحداثتها
- روابط قابلة للمشاركة مع إحصاءات الاستخدام
- تقرير PDF احترافي يُولَّد تلقائياً
- سجل تدقيق كامل لكل عملية
- RBAC بأربعة مستويات صلاحية

---

## المكدس التقني

| الطبقة | التقنية | الإصدار |
|--------|---------|---------|
| **Framework** | Next.js (App Router) | 14.2 |
| **UI** | React + TypeScript | 18 / 5 |
| **Styling** | Tailwind CSS + Radix UI | 3.4 |
| **ORM** | Prisma | 6.19 |
| **Database** | MySQL | 8+ |
| **Auth** | NextAuth.js | 4.24 |
| **Job Queue** | BullMQ + Redis | 5.70 |
| **PDF** | Puppeteer + @sparticuz/chromium | 24 |
| **Email** | Resend / Nodemailer (SMTP) | — |
| **Charts** | Recharts | 3.7 |
| **Validation** | Zod | 4.3 |
| **Forms** | React Hook Form | 7.71 |
| **Data Fetching** | SWR | 2.4 |
| **Testing** | Vitest | 2.1 |

---

## هيكل قاعدة البيانات

### خريطة العلاقات

```
┌──────────────────────────────────────────────────────────────┐
│                        User & Auth                           │
│  User ──< UserRole >── Role                                  │
│  User ──< PasswordResetToken                                 │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                       Core Domain                            │
│  Project ──< Entry          (قوائم بيع + معاملات DLD)       │
│  Project ──< ValuationLink  (روابط العملاء)                  │
│  Project ──< Lead           (طلبات التقييم)                  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                      Valuation Output                        │
│  Lead ──── ValuationResult  (ناتج المحرك)                    │
│  Lead ──── Report           (PDF مُولَّد)                    │
│  Lead ──── SpecialistAssessment (تقييم المختص)               │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    Infrastructure                            │
│  AuditLog   (سجل التدقيق)                                    │
│  Setting    (الإعدادات: branding + valuation rules)          │
└──────────────────────────────────────────────────────────────┘
```

### تفصيل الجداول

#### `Project` — المشاريع العقارية

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | String PK | معرّف فريد |
| `name` | String | اسم المشروع |
| `location` | String? | الموقع الجغرافي |
| `category` | `RESIDENTIAL \| COMMERCIAL` | تصنيف المشروع |
| `defaultType` | PropertyType? | نوع العقار الافتراضي |
| `areaTolerancePct` | Float | نسبة تحمّل فارق المساحة (%) |
| `currency` | String (default: AED) | العملة |
| `isActive` | Boolean | حالة المشروع |

#### `Entry` — بيانات المقارنات

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `sourceType` | `LISTING \| TRANSACTION` | مصدر البيانات |
| `propertyType` | PropertyType | نوع العقار |
| `bedrooms` | Int? | عدد غرف النوم |
| `bathrooms` | Int? | عدد الحمامات |
| `areaSqft` | Float? | المساحة (قدم²) — للقوائم |
| `askPrice` | Float? | سعر الطلب |
| `lowestPrice` | Float? | أدنى سعر |
| `askPsf` | Float? | **سعر الطلب ÷ المساحة** (مُحسوب) |
| `lowPsf` | Float? | **أدنى سعر ÷ المساحة** (مُحسوب) |
| `transactionAreaSqft` | Float? | المساحة الفعلية (معاملات DLD) |
| `transactionPrice` | Float? | سعر المعاملة الفعلي |
| `transactionPsf` | Float? | **سعر المعاملة ÷ المساحة** (مُحسوب) |
| `transactionDate` | DateTime? | تاريخ المعاملة |
| `locationLabel` | String? | وصف الموقع |
| `portal` | String? | المصدر (PropertyFinder…) |

#### `Lead` — طلبات التقييم من العملاء

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | String PK | معرّف الطلب |
| `projectId` | String FK | المشروع المرتبط |
| `linkId` | String FK | الرابط المُستخدَم |
| `fullName` | String | اسم العميل |
| `phone` | String | رقم الهاتف |
| `email` | String? | البريد الإلكتروني |
| `category` | PropertyCategory | تصنيف العقار |
| `propertyType` | PropertyType | نوع العقار |
| `bedrooms` | Int? | الغرف |
| `areaSqft` | Float | المساحة المطلوب تقييمها |
| `clientPrice` | Float? | السعر الذي يطلبه العميل |
| `status` | LeadStatus | حالة المتابعة |
| `assignedAgentId` | String? | الموظف المكلَّف |
| `ipAddress` | String? | عنوان IP للعميل |

#### `ValuationResult` — ناتج محرك التقييم

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `leadId` | String FK | الطلب المرتبط |
| `rulesVersion` | String | إصدار قواعد التقييم |
| `areaTolerancePct` | Float | نسبة تحمّل المساحة المُستخدَمة |
| `outlierMethod` | String | طريقة إزالة الشواذ |
| `minComps` | Int | الحد الأدنى من المقارنات |
| `benchmark` | String | المعيار المُستخدَم |
| `clientPsf` | Float? | **سعر العميل ÷ مساحته** |
| `listingCount` | Int | عدد قوائم البيع المُستخدَمة |
| `listingMeanPsf` | Float? | متوسط PSF للقوائم |
| `listingMedianPsf` | Float? | وسيط PSF للقوائم |
| `listingMinPsf` | Float? | أدنى PSF للقوائم |
| `listingMaxPsf` | Float? | أعلى PSF للقوائم |
| `transactionCount` | Int | عدد معاملات DLD |
| `transactionMeanPsf` | Float? | متوسط PSF للمعاملات |
| `transactionMedianPsf` | Float? | وسيط PSF للمعاملات |
| `transactionMinPsf` | Float? | أدنى PSF للمعاملات |
| `transactionMaxPsf` | Float? | أعلى PSF للمعاملات |
| `recommendedLow` | Float? | السعر المُوصى به (أدنى) |
| `recommendedMid` | Float? | السعر المُوصى به (وسط) |
| `recommendedHigh` | Float? | السعر المُوصى به (أعلى) |
| `verdict` | VerdictLabel | الحكم على السعر |
| `ratioToMarket` | Float? | نسبة سعر العميل إلى السوق |
| `confidence` | Int? | درجة الثقة (0–100) |
| `explanations` | JSON | تفسيرات نصية للنتيجة |
| `compsUsed` | JSON | المقارنات المُستخدَمة (area) |
| `projectValuationData` | JSON? | نتيجة التقييم على مستوى المشروع |
| `projectCompsUsed` | JSON? | مقارنات المشروع المُستخدَمة |

#### `SpecialistAssessment` — تقييم المختص

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `leadId` | String FK | الطلب المرتبط |
| `specialistId` | String FK | المختص المُقيِّم |
| `estimatedPrice` | Float | السعر المُقدَّر من المختص |
| `estimatedPsf` | Float | PSF المُقدَّر |
| `notes` | String? | ملاحظات المختص |

#### `ValuationLink` — روابط التقييم العامة

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `id` | String PK | يُشكّل الـ token في الرابط |
| `projectId` | String FK | المشروع |
| `agentId` | String? FK | الموظف المُنشئ |
| `label` | String? | اسم وصفي للرابط |
| `status` | `ACTIVE \| DISABLED \| EXPIRED` | الحالة |
| `expiresAt` | DateTime? | تاريخ الانتهاء |
| `maxUses` | Int? | الحد الأقصى للاستخدام |
| `usedCount` | Int | عدد الاستخدامات الفعلية |

---

## محرك التقييم — المعادلات الرياضية

الملفات ذات الصلة: `src/valuation/`

### حساب السعر لكل قدم مربع (PSF)

**ملف:** `src/valuation/engine.ts`

```
للقوائم (Listings):
  askPsf  = askPrice    / areaSqft
  lowPsf  = lowestPrice / areaSqft

للمعاملات (DLD Transactions):
  transactionPsf = transactionPrice / transactionAreaSqft

لسعر العميل:
  clientPsf = clientPrice / clientAreaSqft
```

---

### اختيار المقارنات (Comparable Selection)

**ملف:** `src/valuation/matching.ts`

#### خوارزمية التصفية (Two-Pass)

```
المرحلة الأولى — صارمة:
  [1] نوع العقار مطابق  (مع استثناء DLD أدناه)
  [2] عدد الغرف مطابق تماماً
  [3] المساحة ضمن نطاق التحمّل

المرحلة الثانية — مرنة (تُفعَّل إذا عدد النتائج < minComps):
  [1] نوع العقار مطابق
  [2] شرط الغرف مُتجاهَل
  [3] المساحة ضمن نطاق التحمّل
```

#### نطاق تحمّل المساحة (Area Tolerance)

```
lowerBound = clientAreaSqft * (1 - areaTolerancePct / 100)
upperBound = clientAreaSqft * (1 + areaTolerancePct / 100)

المقارنة مقبولة إذا:
  lowerBound <= entryAreaSqft <= upperBound
```

**مثال:** مساحة العميل = 1000 قدم²، tolerance = 20%
```
lowerBound = 1000 * 0.80 = 800
upperBound = 1000 * 1.20 = 1200
→ تُقبل كل إدخالات بين 800 و 1200 قدم²
```

> **استثناء DLD:** المشاريع قيد الإنشاء تُسجَّل معاملاتها كـ `LAND` في DLD. لذا يُعامَل `LAND` معادلاً لـ `VILLA / TOWNHOUSE / DUPLEX / PENTHOUSE` عند البحث في إدخالات نفس المشروع. كذلك تُعفى مقارنات المشروع نفسه من شرط نطاق المساحة.

---

### إزالة الشواذ (Outlier Removal)

**ملف:** `src/valuation/outliers.ts`

#### الطريقة 1: Trim 10% (الافتراضية)

```
1. رتّب قيم PSF تصاعدياً: sorted[0..n-1]
2. cutCount = floor(n * 0.10)
3. النتيجة = sorted[ cutCount .. n - cutCount - 1 ]
```

**مثال:** 20 قيمة → cutCount=2 → احذف أعلى 2 وأدنى 2 → تبقى 16

#### الطريقة 2: IQR (Interquartile Range)

```
Q1 = percentile(sorted, 25)
Q3 = percentile(sorted, 75)
IQR = Q3 - Q1

lowerFence = Q1 - 1.5 * IQR
upperFence = Q3 + 1.5 * IQR

القيم المحتفَظ بها: lowerFence <= PSF <= upperFence
```

#### حساب الـ Percentile (Linear Interpolation)

```
index  = (p / 100) * (n - 1)
lower  = sorted[ floor(index) ]
upper  = sorted[ ceil(index)  ]
weight = index - floor(index)

percentile(p) = lower * (1 - weight) + upper * weight
```

---

### الإحصاء الوصفي

**ملف:** `src/valuation/stats.ts`

```
المتوسط:
  mean = sum(psfValues) / n

الوسيط:
  إذا n فردي:  median = sorted[ (n-1)/2 ]
  إذا n زوجي: median = ( sorted[n/2 - 1] + sorted[n/2] ) / 2

الأدنى:  min = sorted[0]
الأعلى:  max = sorted[n-1]
```

#### اختيار المعيار (Benchmark PSF)

```
إذا benchmark = "transactionMedianPsf":
  الأولوية 1 → transactionMedianPsf  (إذا count > 0)
  الأولوية 2 → listingMedianPsf      (fallback)
  الأولوية 3 → null                  → INSUFFICIENT_DATA

إذا benchmark = "listingMedianPsf":
  الأولوية 1 → listingMedianPsf      (إذا count > 0)
  الأولوية 2 → transactionMedianPsf  (fallback)
  الأولوية 3 → null                  → INSUFFICIENT_DATA
```

---

### التقييم المبني على المنطقة (Area Valuation)

**ملف:** `src/valuation/engine.ts` — الخوارزمية الرئيسية

```
المدخلات:
  clientAreaSqft, clientBedrooms, clientPropertyType, clientPrice

الخوارزمية:
  [1] استخرج قوائم بيع المشروع (LISTING entries)
  [2] استخرج معاملات DLD للموقع كله (TRANSACTION entries)
      مُصفَّاة بنطاق المساحة ونوع العقار والغرف (Two-Pass)
  [3] أزل الشواذ بالطريقة المُختارة
  [4] احسب الإحصاءات لكل مجموعة:
        listingStats     = { count, mean, median, min, max }
        transactionStats = { count, mean, median, min, max }
  [5] تحقق من الحد الأدنى:
        إذا (listingCount + transactionCount) < minComps:
          → verdict = INSUFFICIENT_DATA
  [6] اختر benchmarkPsf (median أو mean حسب الإعداد)
  [7] احسب نطاق السعر الموصى به:
        recommendedLow  = min(كل PSF المُنقّاة) * clientAreaSqft
        recommendedMid  = benchmarkPsf           * clientAreaSqft
        recommendedHigh = max(كل PSF المُنقّاة) * clientAreaSqft
  [8] احسب clientPsf = clientPrice / clientAreaSqft
  [9] طبّق معادلة الـ Verdict
  [10] احسب درجة الثقة (Confidence Score)
```

---

### التقييم المبني على المشروع (Project Valuation)

**ملف:** `app/api/public/v/[token]/submit/route.ts`

نفس خوارزمية Area Valuation لكن مع تقييد المصادر:

```
مقارنات المشروع = قوائم المشروع + معاملات المشروع فقط
                  (بدلاً من كل معاملات الموقع الجغرافي)

النتيجة مُخزَّنة في:
  ValuationResult.projectValuationData  (JSON — كامل ناتج المحرك)
  ValuationResult.projectCompsUsed      (JSON — المقارنات المُستخدَمة)
```

يتيح هذا مقارنة التقييم على مستويين:
- **Area Valuation** → السوق العام للمنطقة الجغرافية
- **Project Valuation** → أداء المشروع تحديداً

---

### تقييم المختص (Specialist Assessment)

**ملف:** `app/api/leads/[leadId]/specialist-assessment/route.ts`

```
المدخلات: estimatedPrice (من الموظف المختص)

estimatedPsf = estimatedPrice / lead.areaSqft

يُعرض جنباً إلى جنب مع التقييمين الآليين:
  بطاقة 1: Area Valuation    (السوق العام)
  بطاقة 2: Project Valuation (مستوى المشروع)
  بطاقة 3: Specialist        (رأي الإنسان المختص)
```

---

### الحكم على السعر (Verdict)

**ملف:** `src/valuation/verdict.ts`

```
ratio = clientPsf / benchmarkPsf

إذا ratio < threshold_below_market  → BELOW_MARKET    (أقل من السوق)
إذا ratio <= threshold_aligned_max   → ALIGNED         (متوافق مع السوق)
إذا ratio <= threshold_slightly_max  → SLIGHTLY_ABOVE  (أعلى قليلاً)
غير ذلك                              → ABOVE_MARKET    (أعلى من السوق)
```

**العتبات الافتراضية** (قابلة للتعديل من `/admin/settings/valuation-rules`):

| العتبة | القيمة الافتراضية | المعنى |
|--------|------------------|--------|
| `threshold_below_market` | 0.95 | أقل من 95% من السوق |
| `threshold_aligned_max` | 1.05 | بين 95%–105% |
| `threshold_slightly_max` | 1.15 | بين 105%–115% |
| فوق | > 1.15 | أكثر من 15% فوق السوق |

---

### درجة الثقة (Confidence Score)

**ملف:** `src/valuation/scoring.ts`

درجة من **0 إلى 100** مجموع أربعة عوامل:

#### العامل 1: حجم المقارنات (0–40 نقطة)

| عدد المقارنات | النقاط |
|---------------|--------|
| ≥ 15 | 40 |
| ≥ 10 | 30 |
| ≥ 7 | 25 |
| ≥ 5 | 20 |
| ≥ 3 | 10 |
| < 3 | 0 |

#### العامل 2: وجود معاملات DLD (0–10 نقاط)

| عدد معاملات DLD | النقاط |
|-----------------|--------|
| ≥ 5 | 10 |
| ≥ 3 | 7 |
| ≥ 1 | 3 |
| 0 | 0 |

#### العامل 3: تباين البيانات — Coefficient of Variation (0–30 نقطة)

```
mean     = average(psfValues)
variance = sum( (psfᵢ - mean)² ) / (n - 1)
stdDev   = sqrt(variance)
CV       = stdDev / mean
```

| CV (معامل التباين) | النقاط |
|--------------------|--------|
| CV < 0.05 | 30 |
| CV < 0.10 | 25 |
| CV < 0.15 | 18 |
| CV < 0.25 | 10 |
| CV ≥ 0.25 | 3 |

#### العامل 4: حداثة البيانات (0–20 نقطة)

| آخر معاملة DLD | النقاط |
|----------------|--------|
| ≤ 6 أشهر | 20 |
| > 6 أشهر أو لا توجد | 5 |

#### الدرجة الإجمالية

```
confidence = نقاط_الحجم + نقاط_المعاملات + نقاط_التباين + نقاط_الحداثة
             (الحد الأقصى: 100)
```

---

## تدفق التقييم الكامل

```
العميل
  │
  ├─ يفتح رابط التقييم: https://domain.com/v/{linkId}
  │
  ▼
GET /api/public/v/{token}/meta
  │  التحقق: status=ACTIVE، لم ينته، usedCount < maxUses
  │  الإرجاع: اسم المشروع، الموقع، العملة، نوع العقار الافتراضي
  │
  ▼
نموذج 3 خطوات:
  الخطوة 1 — بيانات الاتصال: الاسم + الهاتف + الإيميل
  الخطوة 2 — بيانات العقار:   النوع + الغرف + المساحة + السعر
  الخطوة 3 — النتائج الفورية
  │
  ▼
POST /api/public/v/{token}/submit
  │  [1] Rate Limit: 5 طلبات / دقيقة / IP
  │  [2] التحقق من صلاحية الرابط
  │  [3] التحقق من البيانات (Zod Schema)
  │  [4] Area Valuation  → benchmarkPsf + verdict + confidence + range
  │  [5] Project Valuation → projectValuationData
  │  [6] إنشاء (atomic):
  │        Lead + ValuationResult + Report(QUEUED)
  │  [7] usedCount += 1
  │  [8] BullMQ ← مهمة توليد PDF
  │  [9] إرجاع النتيجة للعميل فوراً
  │
  ▼
BullMQ Worker (خلفي)
  │  renderHtml.ts → بناء HTML من البيانات + Branding
  │  generatePdf.ts → Puppeteer → PDF buffer
  │  Report.pdfData = buffer | Report.status = READY
  │
  ▼
GET /api/public/v/report/{leadId}
  تنزيل PDF (بدون تسجيل دخول)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
لوحة الإدارة (بالتوازي):
  Lead يظهر في /admin/leads بحالة NEW
  الموظف يرى: Area + Project + يُضيف Specialist Assessment
  سير حالة العميل: NEW → CONTACTED → QUALIFIED → APPOINTMENT_SET → WON/LOST
```

---

## الأدوار والصلاحيات RBAC

**ملف:** `src/auth/rbac.ts`

### الأدوار

| الدور | الكود | الوصف |
|-------|-------|-------|
| المدير العام | `ADMIN` | صلاحيات كاملة بلا قيود |
| المدير | `MANAGER` | إدارة المشاريع والعملاء والتقارير والتحليلات |
| الموظف | `AGENT` | إنشاء روابط وإدارة العملاء المكلَّف بهم |
| المشاهد | `VIEWER` | قراءة فقط |

### مصفوفة الصلاحيات

| الصلاحية | ADMIN | MANAGER | AGENT | VIEWER |
|----------|:-----:|:-------:|:-----:|:------:|
| **المشاريع** | | | | |
| عرض | ✅ | ✅ | ✅ | ✅ |
| إنشاء / تعديل | ✅ | ✅ | ✅ | ❌ |
| حذف | ✅ | ❌ | ❌ | ❌ |
| **المقارنات (Entries)** | | | | |
| عرض | ✅ | ✅ | ✅ | ✅ |
| إضافة / تعديل | ✅ | ✅ | ✅ | ❌ |
| حذف | ✅ | ✅ | ❌ | ❌ |
| **روابط التقييم** | | | | |
| عرض | ✅ | ✅ | ✅ | ❌ |
| إنشاء / تعديل | ✅ | ✅ | ✅ | ❌ |
| حذف / تعطيل | ✅ | ✅ | ❌ | ❌ |
| **العملاء (Leads)** | | | | |
| عرض الجميع | ✅ | ✅ | ❌ | ❌ |
| عرض المكلَّف بهم | ✅ | ✅ | ✅ | ❌ |
| تحديث الحالة | ✅ | ✅ | ✅ | ❌ |
| تكليف موظف | ✅ | ✅ | ❌ | ❌ |
| **التقارير** | | | | |
| عرض الجميع | ✅ | ✅ | ❌ | ❌ |
| عرض المكلَّف بهم | ✅ | ✅ | ✅ | ❌ |
| توليد PDF | ✅ | ✅ | ✅ | ❌ |
| تقييم المختص | ✅ | ✅ | ✅ | ❌ |
| **الإعدادات** | | | | |
| عرض | ✅ | ✅ | ❌ | ❌ |
| تعديل | ✅ | ❌ | ❌ | ❌ |
| **الفريق** | | | | |
| إدارة المستخدمين | ✅ | ❌ | ❌ | ❌ |
| **التحليلات** | | | | |
| عرض | ✅ | ✅ | ❌ | ❌ |
| **سجل التدقيق** | | | | |
| عرض | ✅ | ❌ | ❌ | ❌ |

### حماية المسارات

**ملف:** `middleware.ts`

```
محمية (تسجيل دخول مطلوب):   /admin/*
مقيَّدة بدور ADMIN فقط:      /admin/settings
                              /admin/audit
                              /admin/team
عامة (بدون تسجيل دخول):     /v/[token]
                              /login
                              /api/public/*
                              /api/auth/*
                              /api/health
```

---

## روابط التقييم

### دورة حياة الرابط

```
إنشاء الرابط (ADMIN / MANAGER / AGENT)
  │  خيارات: label، expiresAt، maxUses، agentId (للإسناد)
  ▼
الرابط العام: https://domain.com/v/{linkId}
  │
  ▼
العميل يفتح الرابط
  │  التحقق: status = ACTIVE
  │           لم يتجاوز expiresAt
  │           usedCount < maxUses (أو maxUses = null)
  ▼
العميل يرسل النموذج
  │  usedCount += 1
  ▼
Lead جديد منسوب للرابط وللموظف المُنشئ
```

### ما يمكن تخصيصه لكل رابط

| الخيار | الوصف | مثال |
|--------|-------|-------|
| `label` | اسم وصفي | "حملة إنستغرام — أكتوبر" |
| `expiresAt` | تاريخ انتهاء الصلاحية | 2024-12-31 |
| `maxUses` | حد الاستخدام | 100 |
| `agentId` | نسب Leads لموظف معين | — |

---

## توليد تقارير PDF

**الملفات:** `src/pdf/`

### خط أنابيب التوليد

```
[1] العميل يُرسل → Report{status: QUEUED} يُنشأ
[2] مهمة تُضاف إلى BullMQ (Redis)
[3] Worker يلتقط المهمة:
      renderHtml.ts:
        → Lead + ValuationResult + SpecialistAssessment من DB
        → إعدادات Branding (شعار، ألوان، إخلاء مسؤولية)
        → buildReportHtml() → سلسلة HTML كاملة
[4] generatePdf.ts:
      → Puppeteer يشغّل Chrome بدون واجهة
      → HTML → PDF (A4، بدون هوامش، خلفية مطبوعة)
      → يحسب SHA256 checksum
      → يُرجع buffer + checksum + fileSize
[5] Report{status: READY, pdfData: buffer} يُحدَّث في DB
```

### محتوى تقرير PDF

| القسم | الوصف |
|-------|-------|
| الترويسة | شعار الشركة، اسمها، بيانات الاتصال |
| ملخص العقار | النوع، الغرف، المساحة، السعر المطلوب |
| الحكم والثقة | Verdict + درجة الثقة (0-100) |
| مقارنات قوائم البيع | الموقع، السعر، المساحة، PSF |
| مقارنات معاملات DLD | التاريخ، السعر، المساحة، PSF |
| تقييم المشروع | Area vs Project Valuation |
| تقييم المختص | إذا أُضيف من الإدارة |
| التفسيرات | سبب الحكم، شرح البيانات |
| التذييل | تاريخ التوليد + إخلاء المسؤولية |

### مصادر Chrome (بالترتيب)

```
[1] PUPPETEER_EXECUTABLE_PATH  (متغير بيئة — الأولوية القصوى)
[2] @sparticuz/chromium         (للبيئات المحدودة: Docker/Lambda)
[3] Chrome المثبَّت على النظام  (/usr/bin/google-chrome-stable…)
[4] puppeteer الكامل            (Chrome مُنزَّل عند npm install)
```

---

## واجهات API الكاملة

### المصادقة

| المسار | الطريقة | الوصف |
|--------|---------|-------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js (دخول/خروج/session) |
| `/api/auth/forgot-password` | POST | طلب إعادة تعيين كلمة المرور |
| `/api/auth/reset-password` | POST | إكمال إعادة التعيين بالرمز |

### المشاريع

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/projects` | GET | جميع | قائمة (search, isActive, category, page, sort) |
| `/api/projects` | POST | ADMIN, MANAGER | إنشاء مشروع |
| `/api/projects/[id]` | GET | جميع | تفاصيل مشروع |
| `/api/projects/[id]` | PATCH | ADMIN, MANAGER | تعديل مشروع |
| `/api/projects/[id]` | DELETE | ADMIN | تعطيل مشروع |

### المقارنات

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/projects/[id]/entries` | GET | جميع | قائمة (sourceType, propertyType, bedrooms) |
| `/api/projects/[id]/entries` | POST | ADMIN, MANAGER, AGENT | إضافة مقارنة |
| `/api/projects/[id]/entries/import` | POST | ADMIN, MANAGER, AGENT | استيراد مجموعة |
| `/api/projects/[id]/entries/[eId]` | GET | جميع | تفاصيل مقارنة |
| `/api/projects/[id]/entries/[eId]` | PATCH | ADMIN, MANAGER, AGENT | تعديل (يعيد حساب PSF) |
| `/api/projects/[id]/entries/[eId]` | DELETE | ADMIN, MANAGER | تعطيل |

### روابط التقييم

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/projects/[id]/links` | GET | ADMIN, MANAGER, AGENT | قائمة الروابط |
| `/api/projects/[id]/links` | POST | ADMIN, MANAGER, AGENT | إنشاء رابط |
| `/api/projects/[id]/links/[lId]` | GET | ADMIN, MANAGER, AGENT | تفاصيل رابط |
| `/api/projects/[id]/links/[lId]` | PATCH | ADMIN, MANAGER, AGENT | تعديل رابط |
| `/api/projects/[id]/links/[lId]` | DELETE | ADMIN, MANAGER | حذف رابط |

### التقييم العام (بدون تسجيل دخول)

| المسار | الطريقة | الوصف |
|--------|---------|-------|
| `/api/public/v/[token]/meta` | GET | بيانات المشروع لتهيئة النموذج |
| `/api/public/v/[token]/submit` | POST | **إرسال التقييم** (rate-limited: 5/min/IP) |
| `/api/public/v/report/[leadId]` | GET | تنزيل تقرير PDF |

### العملاء المحتملين

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/leads` | GET | ADMIN, MANAGER | قائمة (status, verdict, projectId, dateFrom/To) |
| `/api/leads/[id]` | GET | ADMIN, MANAGER, AGENT | تفاصيل |
| `/api/leads/[id]` | PATCH | ADMIN, MANAGER, AGENT | تعديل بيانات الاتصال |
| `/api/leads/[id]/status` | PATCH | ADMIN, MANAGER, AGENT | تحديث الحالة |
| `/api/leads/[id]/assign` | PATCH | ADMIN, MANAGER | تكليف موظف |
| `/api/leads/[id]/revalue` | POST | ADMIN, MANAGER | إعادة التقييم |
| `/api/leads/[id]/specialist-assessment` | GET/POST | ADMIN, MANAGER, AGENT | تقييم المختص |
| `/api/leads/[id]/report` | GET | ADMIN, MANAGER, AGENT | حالة التقرير |
| `/api/leads/[id]/report` | POST | ADMIN, MANAGER, AGENT | توليد PDF مباشرة |

### التحليلات

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/dashboard/kpis` | GET | ADMIN, MANAGER | مؤشرات الأداء الرئيسية |
| `/api/analytics/market` | GET | ADMIN, MANAGER | اتجاهات أسعار السوق |
| `/api/analytics/areas` | GET | ADMIN, MANAGER | تحليل PSF حسب المنطقة |
| `/api/analytics/areas-breakdown` | GET | ADMIN, MANAGER | إحصاءات تفصيلية |
| `/api/analytics/projects` | GET | ADMIN, MANAGER | أداء المشاريع |
| `/api/analytics/report` | GET | ADMIN, MANAGER | تقرير تحليلي شامل |

### الإعدادات والفريق

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/settings/valuation-rules` | GET/PUT | ADMIN | قواعد التقييم |
| `/api/settings/branding` | GET/PUT | ADMIN | هوية الشركة |
| `/api/team` | GET, POST | ADMIN | قائمة / إنشاء مستخدم |
| `/api/team/[uId]` | GET, PATCH, DELETE | ADMIN | إدارة مستخدم |
| `/api/audit` | GET | ADMIN | سجل التدقيق |

### الأدوات

| المسار | الطريقة | الصلاحية | الوصف |
|--------|---------|----------|-------|
| `/api/tools/pf-scrape` | POST | ADMIN, MANAGER, AGENT | استخراج قوائم من PropertyFinder |
| `/api/health` | GET | عام | فحص صحة الخادم |

---

## لوحة الإدارة

| القسم | المسار | الوصف | الصلاحية |
|-------|--------|-------|----------|
| Dashboard | `/admin` | KPIs وآخر العملاء | جميع |
| العملاء | `/admin/leads` | قائمة مع تصفية متقدمة | جميع |
| تفاصيل العميل | `/admin/leads/[id]` | التقييم الثلاثي + سير الحالة | جميع |
| المشاريع | `/admin/projects` | قائمة + إنشاء + إحصاءات | جميع |
| المقارنات | `/admin/projects/[id]/entries` | إدارة قوائم البيع والمعاملات | ADMIN, MANAGER, AGENT |
| روابط التقييم | `/admin/projects/[id]/links` | إنشاء وإدارة الروابط العامة | ADMIN, MANAGER, AGENT |
| التحليلات | `/admin/analytics` | رسوم بيانية لاتجاهات السوق | ADMIN, MANAGER |
| التقارير | `/admin/reports` | عرض وتنزيل تقارير PDF | ADMIN, MANAGER, AGENT |
| استيراد القوائم | `/admin/tools/import-listings` | استيراد من PropertyFinder | ADMIN, MANAGER, AGENT |
| الفريق | `/admin/team` | إدارة المستخدمين والأدوار | ADMIN |
| الإعدادات | `/admin/settings` | قواعد التقييم + الهوية البصرية | ADMIN |
| سجل التدقيق | `/admin/audit` | سجل لا يقبل التعديل | ADMIN |

### مسار حياة العميل المحتمل

```
NEW ──► CONTACTED ──► QUALIFIED ──► APPOINTMENT_SET ──► WON
                                                     └──► LOST
                                                     └──► ARCHIVED
```

---

## متغيرات البيئة

```env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# التطبيق
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# قاعدة البيانات
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE_URL="mysql://user:password@host:3306/ist_valuation"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# المصادقة (NextAuth.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=minimum-32-character-random-secret

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# قائمة المهام الخلفية (BullMQ)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REDIS_URL=redis://localhost:6379

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# البريد الإلكتروني
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL_FROM=noreply@yourcompany.com

# الخيار أ: Resend (موصى به)
EMAIL_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# الخيار ب: SMTP عام
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# توليد PDF (اختياري)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# يحدد مسار Chrome/Chromium يدوياً
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# S3 / Cloudflare R2 (اختياري)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S3_BUCKET=ist-reports
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

---

## التثبيت والتشغيل

### المتطلبات

- Node.js ≥ 18
- MySQL 8+
- Redis ≥ 6

### التثبيت المحلي

```bash
# 1. استنساخ المستودع
git clone https://github.com/mertsadekist/propintels.git
cd ist-valuation-platform

# 2. تثبيت الاعتماديات
npm install

# 3. إعداد متغيرات البيئة
cp .env.example .env
# عدّل .env بقيمك الفعلية

# 4. إنشاء الجداول
npx prisma db push

# 5. تشغيل بيئة التطوير
npm run dev        # http://localhost:3000

# 6. تشغيل الاختبارات
npm test

# 7. البناء للإنتاج
npm run build
npm start
```

### النشر بـ Docker / Coolify

المشروع مُعدَّ لـ Next.js Standalone output:

```bash
# بناء الصورة
docker build -t ist-valuation .

# تشغيل الحاوية
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e REDIS_URL="redis://..." \
  -e NEXT_PUBLIC_APP_URL="https://yourdomain.com" \
  ist-valuation
```

للنشر على **Coolify**: اربط المستودع `mertsadekist/propintels` وحدد فرع `master` — سيعمل بناء Docker تلقائياً عند كل `git push`.

---

## بنية الملفات

```
ist-valuation-platform/
│
├── app/                               # Next.js App Router
│   ├── (admin)/admin/                 # لوحة الإدارة (authenticated)
│   │   ├── analytics/                 # التحليلات والرسوم البيانية
│   │   ├── audit/                     # سجل التدقيق
│   │   ├── leads/[leadId]/            # إدارة العملاء (التقييم الثلاثي)
│   │   ├── projects/[projectId]/
│   │   │   ├── entries/               # إدارة المقارنات
│   │   │   └── links/                 # روابط التقييم
│   │   ├── reports/                   # عرض وتنزيل PDF
│   │   ├── settings/
│   │   │   ├── branding/              # الهوية البصرية
│   │   │   └── valuation-rules/       # قواعد محرك التقييم
│   │   ├── team/                      # إدارة المستخدمين
│   │   └── tools/import-listings/     # استيراد من PropertyFinder
│   ├── (auth)/                        # تسجيل الدخول وإعادة التعيين
│   ├── (public)/v/[token]/            # نموذج العميل العام (3 خطوات)
│   └── api/                           # API Routes
│       ├── auth/                      # NextAuth + password reset
│       ├── analytics/                 # إحصاءات السوق
│       ├── dashboard/                 # KPIs
│       ├── leads/[leadId]/            # إدارة العملاء
│       ├── projects/[projectId]/      # المشاريع + المقارنات + الروابط
│       ├── public/v/                  # Endpoints عامة
│       ├── settings/                  # الإعدادات
│       ├── team/                      # الفريق
│       └── tools/                     # الأدوات (pf-scrape)
│
├── src/
│   ├── auth/
│   │   ├── auth.config.ts             # إعداد NextAuth.js
│   │   └── rbac.ts                    # تعريف الصلاحيات
│   ├── components/
│   │   ├── admin/                     # مكونات لوحة الإدارة
│   │   ├── public/                    # مكونات النموذج العام
│   │   └── ui/                        # shadcn/ui (Radix-based)
│   ├── db/                            # Prisma client + repositories
│   ├── jobs/                          # BullMQ workers (PDF queue)
│   ├── notifications/
│   │   ├── mail.ts                    # SMTP / Resend adapter
│   │   └── templates/                 # قوالب البريد الإلكتروني
│   ├── pdf/
│   │   ├── generatePdf.ts             # Puppeteer → PDF buffer
│   │   ├── renderHtml.ts              # بناء HTML من البيانات
│   │   └── templates/report.template.ts  # قالب تقرير PDF
│   ├── valuation/
│   │   ├── engine.ts                  # الخوارزمية الرئيسية
│   │   ├── matching.ts                # اختيار المقارنات (Two-Pass)
│   │   ├── outliers.ts                # إزالة الشواذ (Trim10 / IQR)
│   │   ├── scoring.ts                 # درجة الثقة (0–100)
│   │   ├── stats.ts                   # الإحصاء الوصفي + Benchmark
│   │   └── verdict.ts                 # الحكم على السعر
│   └── validation/                    # مخططات Zod
│
├── prisma/
│   └── schema.prisma                  # تعريف قاعدة البيانات (MySQL)
│
├── public/                            # الأصول الثابتة
├── middleware.ts                       # حماية مسارات /admin/*
├── next.config.mjs                    # output: 'standalone' + إعدادات
└── package.json
```

---

## الترخيص

هذا المشروع مملوك لـ **IST Valuation**. جميع الحقوق محفوظة.

---

*آخر تحديث: مارس 2026*
