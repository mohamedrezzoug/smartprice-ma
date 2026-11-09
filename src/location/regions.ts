/**
 * Moroccan administrative regions (12, per the 2015 territorial division),
 * their major cities, and starter neighborhoods for the main cities.
 *
 * City `center` coordinates are approximate public city-centre positions.
 * They are ONLY used to (a) centre the map and (b) estimate the nearest city
 * when reverse geocoding is unavailable (e.g. offline). They are never used
 * as store locations or to compute store distances.
 */

export type Region = {id: string; ar: string; fr: string}
export type City = {id: string; region: string; ar: string; fr: string; center: [number, number]; aliases?: string[]}
export type Neighborhood = {id: string; city: string; ar: string; fr: string}

export const regions: Region[] = [
  {id: 'tth', ar: 'طنجة - تطوان - الحسيمة', fr: 'Tanger-Tétouan-Al Hoceïma'},
  {id: 'oriental', ar: 'جهة الشرق', fr: "L'Oriental"},
  {id: 'fm', ar: 'فاس - مكناس', fr: 'Fès-Meknès'},
  {id: 'rsk', ar: 'الرباط - سلا - القنيطرة', fr: 'Rabat-Salé-Kénitra'},
  {id: 'bmk', ar: 'بني ملال - خنيفرة', fr: 'Béni Mellal-Khénifra'},
  {id: 'cs', ar: 'الدار البيضاء - سطات', fr: 'Casablanca-Settat'},
  {id: 'ms', ar: 'مراكش - آسفي', fr: 'Marrakech-Safi'},
  {id: 'dt', ar: 'درعة - تافيلالت', fr: 'Drâa-Tafilalet'},
  {id: 'sm', ar: 'سوس - ماسة', fr: 'Souss-Massa'},
  {id: 'gon', ar: 'كلميم - واد نون', fr: 'Guelmim-Oued Noun'},
  {id: 'lsh', ar: 'العيون - الساقية الحمراء', fr: 'Laâyoune-Sakia El Hamra'},
  {id: 'dod', ar: 'الداخلة - وادي الذهب', fr: 'Dakhla-Oued Ed-Dahab'},
]

const c = (id: string, region: string, ar: string, fr: string, lat: number, lng: number, aliases?: string[]): City =>
  ({id, region, ar, fr, center: [lat, lng], aliases})

export const moroccanCities: City[] = [
  // Tanger-Tétouan-Al Hoceïma
  c('tanger', 'tth', 'طنجة', 'Tanger', 35.7595, -5.834, ['tangier', 'tanja']),
  c('tetouan', 'tth', 'تطوان', 'Tétouan', 35.5785, -5.3684, ['tetuan']),
  c('alhoceima', 'tth', 'الحسيمة', 'Al Hoceïma', 35.2517, -3.9372),
  c('larache', 'tth', 'العرائش', 'Larache', 35.1932, -6.1557),
  c('ksarelkebir', 'tth', 'القصر الكبير', 'Ksar El Kébir', 35.0017, -5.9083),
  c('chefchaouen', 'tth', 'شفشاون', 'Chefchaouen', 35.1688, -5.2636),
  c('fnideq', 'tth', 'الفنيدق', 'Fnideq', 35.8497, -5.3575),
  c('mdiq', 'tth', 'المضيق', "M'diq", 35.6858, -5.3253),
  c('ouezzane', 'tth', 'وزان', 'Ouezzane', 34.7969, -5.5794),
  // Oriental
  c('oujda', 'oriental', 'وجدة', 'Oujda', 34.6814, -1.9086),
  c('nador', 'oriental', 'الناظور', 'Nador', 35.1681, -2.9335),
  c('berkane', 'oriental', 'بركان', 'Berkane', 34.92, -2.32),
  c('taourirt', 'oriental', 'تاوريرت', 'Taourirt', 34.4073, -2.8973),
  c('guercif', 'oriental', 'جرسيف', 'Guercif', 34.2257, -3.3536),
  c('jerada', 'oriental', 'جرادة', 'Jerada', 34.3117, -2.1636),
  c('driouch', 'oriental', 'الدريوش', 'Driouch', 34.98, -3.39),
  c('figuig', 'oriental', 'فكيك', 'Figuig', 32.1094, -1.2286),
  // Fès-Meknès
  c('fes', 'fm', 'فاس', 'Fès', 34.0331, -5.0003, ['fez']),
  c('meknes', 'fm', 'مكناس', 'Meknès', 33.8935, -5.5473),
  c('taza', 'fm', 'تازة', 'Taza', 34.21, -4.01),
  c('ifrane', 'fm', 'إفران', 'Ifrane', 33.5228, -5.1106),
  c('sefrou', 'fm', 'صفرو', 'Sefrou', 33.8305, -4.8353),
  c('elhajeb', 'fm', 'الحاجب', 'El Hajeb', 33.6928, -5.3711),
  c('azrou', 'fm', 'أزرو', 'Azrou', 33.4342, -5.2213),
  c('taounate', 'fm', 'تاونات', 'Taounate', 34.5358, -4.64),
  c('missour', 'fm', 'ميسور', 'Missour', 33.0469, -3.9928),
  // Rabat-Salé-Kénitra
  c('rabat', 'rsk', 'الرباط', 'Rabat', 34.0209, -6.8416),
  c('sale', 'rsk', 'سلا', 'Salé', 34.0531, -6.7985),
  c('kenitra', 'rsk', 'القنيطرة', 'Kénitra', 34.261, -6.5802),
  c('temara', 'rsk', 'تمارة', 'Témara', 33.9287, -6.9063),
  c('skhirat', 'rsk', 'الصخيرات', 'Skhirat', 33.8527, -7.0316),
  c('khemisset', 'rsk', 'الخميسات', 'Khémisset', 33.824, -6.0663),
  c('sidikacem', 'rsk', 'سيدي قاسم', 'Sidi Kacem', 34.226, -5.711),
  c('sidislimane', 'rsk', 'سيدي سليمان', 'Sidi Slimane', 34.2648, -5.9256),
  c('tiflet', 'rsk', 'تيفلت', 'Tiflet', 33.8946, -6.3065),
  // Béni Mellal-Khénifra
  c('benimellal', 'bmk', 'بني ملال', 'Béni Mellal', 32.3373, -6.3498),
  c('khouribga', 'bmk', 'خريبكة', 'Khouribga', 32.8811, -6.9063),
  c('khenifra', 'bmk', 'خنيفرة', 'Khénifra', 32.9394, -5.6675),
  c('fquihbensalah', 'bmk', 'الفقيه بن صالح', 'Fquih Ben Salah', 32.5, -6.69),
  c('azilal', 'bmk', 'أزيلال', 'Azilal', 31.9617, -6.5717),
  c('kasbatadla', 'bmk', 'قصبة تادلة', 'Kasba Tadla', 32.5977, -6.2684),
  // Casablanca-Settat
  c('casablanca', 'cs', 'الدار البيضاء', 'Casablanca', 33.5731, -7.5898, ['casa', 'dar el beida', 'الدارالبيضاء']),
  c('mohammedia', 'cs', 'المحمدية', 'Mohammédia', 33.6866, -7.383),
  c('eljadida', 'cs', 'الجديدة', 'El Jadida', 33.2316, -8.5007),
  c('settat', 'cs', 'سطات', 'Settat', 33.001, -7.6166),
  c('berrechid', 'cs', 'برشيد', 'Berrechid', 33.2655, -7.5875),
  c('bouskoura', 'cs', 'بوسكورة', 'Bouskoura', 33.4489, -7.6486),
  c('azemmour', 'cs', 'أزمور', 'Azemmour', 33.2878, -8.342),
  c('sidibennour', 'cs', 'سيدي بنور', 'Sidi Bennour', 32.65, -8.425),
  c('benslimane', 'cs', 'بنسليمان', 'Benslimane', 33.6122, -7.1211),
  // Marrakech-Safi
  c('marrakech', 'ms', 'مراكش', 'Marrakech', 31.6295, -7.9811, ['marrakesh']),
  c('safi', 'ms', 'آسفي', 'Safi', 32.2994, -9.2372),
  c('essaouira', 'ms', 'الصويرة', 'Essaouira', 31.5085, -9.7595),
  c('kelaasraghna', 'ms', 'قلعة السراغنة', 'El Kelâa des Sraghna', 32.0481, -7.4083),
  c('youssoufia', 'ms', 'اليوسفية', 'Youssoufia', 32.2463, -8.5294),
  c('benguerir', 'ms', 'ابن جرير', 'Ben Guerir', 32.236, -7.953),
  c('chichaoua', 'ms', 'شيشاوة', 'Chichaoua', 31.5333, -8.7667),
  // Drâa-Tafilalet
  c('errachidia', 'dt', 'الرشيدية', 'Errachidia', 31.9314, -4.4246),
  c('ouarzazate', 'dt', 'ورزازات', 'Ouarzazate', 30.9189, -6.8934),
  c('zagora', 'dt', 'زاكورة', 'Zagora', 30.3324, -5.8384),
  c('tinghir', 'dt', 'تنغير', 'Tinghir', 31.5147, -5.5328),
  c('midelt', 'dt', 'ميدلت', 'Midelt', 32.6852, -4.7451),
  c('erfoud', 'dt', 'أرفود', 'Erfoud', 31.4333, -4.2333),
  c('rissani', 'dt', 'الريصاني', 'Rissani', 31.2833, -4.2667),
  // Souss-Massa
  c('agadir', 'sm', 'أكادير', 'Agadir', 30.4278, -9.5981),
  c('inezgane', 'sm', 'إنزكان', 'Inezgane', 30.3553, -9.5361),
  c('aitmelloul', 'sm', 'أيت ملول', 'Aït Melloul', 30.3342, -9.4972),
  c('taroudant', 'sm', 'تارودانت', 'Taroudant', 30.4703, -8.877),
  c('tiznit', 'sm', 'تيزنيت', 'Tiznit', 29.6974, -9.7316),
  c('ouladteima', 'sm', 'أولاد تايمة', 'Oulad Teima', 30.3947, -9.2097),
  c('tata', 'sm', 'طاطا', 'Tata', 29.7428, -7.9725),
  // Guelmim-Oued Noun
  c('guelmim', 'gon', 'كلميم', 'Guelmim', 28.987, -10.0574),
  c('tantan', 'gon', 'طانطان', 'Tan-Tan', 28.438, -11.1032),
  c('sidiifni', 'gon', 'سيدي إفني', 'Sidi Ifni', 29.3797, -10.173),
  c('assa', 'gon', 'أسا', 'Assa', 28.61, -9.427),
  // Laâyoune-Sakia El Hamra
  c('laayoune', 'lsh', 'العيون', 'Laâyoune', 27.1253, -13.1625),
  c('boujdour', 'lsh', 'بوجدور', 'Boujdour', 26.1253, -14.4847),
  c('tarfaya', 'lsh', 'طرفاية', 'Tarfaya', 27.9378, -12.9264),
  c('smara', 'lsh', 'السمارة', 'Es-Semara', 26.7418, -11.6719, ['smara', 'semara']),
  // Dakhla-Oued Ed-Dahab
  c('dakhla', 'dod', 'الداخلة', 'Dakhla', 23.6848, -15.958),
  c('aousserd', 'dod', 'أوسرد', 'Aousserd', 22.553, -14.329),
]

const n = (city: string, list: [string, string, string][]): Neighborhood[] =>
  list.map(([id, ar, fr]) => ({id: `${city}:${id}`, city, ar, fr}))

export const neighborhoods: Neighborhood[] = [
  ...n('casablanca', [
    ['maarif', 'المعاريف', 'Maârif'], ['anfa', 'أنفا', 'Anfa'], ['aindiab', 'عين الذئاب', 'Aïn Diab'],
    ['gauthier', 'غوتييه', 'Gauthier'], ['racine', 'راسين', 'Racine'], ['bourgogne', 'بوركون', 'Bourgogne'],
    ['californie', 'كاليفورنيا', 'Californie'], ['oasis', 'الواحة', 'Oasis'], ['belvedere', 'بلفدير', 'Belvédère'],
    ['hayhassani', 'الحي الحسني', 'Hay Hassani'], ['oulfa', 'الألفة', 'Oulfa'], ['sidimaarouf', 'سيدي معروف', 'Sidi Maârouf'],
    ['ainchock', 'عين الشق', 'Aïn Chock'], ['ainsebaa', 'عين السبع', 'Aïn Sebaâ'], ['bernoussi', 'سيدي البرنوصي', 'Sidi Bernoussi'],
    ['haymohammadi', 'الحي المحمدي', 'Hay Mohammadi'], ['derbsultan', 'درب السلطان', 'Derb Sultan'],
    ['sbata', 'سباتة', 'Sbata'], ['benmsick', 'بن مسيك', "Ben M'Sick"], ['moulayrachid', 'مولاي رشيد', 'Moulay Rachid'],
  ]),
  ...n('rabat', [
    ['agdal', 'أكدال', 'Agdal'], ['hassan', 'حسان', 'Hassan'], ['hayriad', 'حي الرياض', 'Hay Riad'],
    ['souissi', 'السويسي', 'Souissi'], ['ocean', 'المحيط', "L'Océan"], ['yacoubmansour', 'يعقوب المنصور', 'Yacoub El Mansour'],
    ['youssoufia', 'اليوسفية', 'Youssoufia'], ['takaddoum', 'التقدم', 'Takaddoum'], ['akkari', 'العكاري', 'Akkari'],
    ['diourjamaa', 'ديور الجامع', 'Diour Jamaâ'],
  ]),
  ...n('sale', [
    ['tabriquet', 'تابريكت', 'Tabriquet'], ['haysalam', 'حي السلام', 'Hay Salam'], ['bettana', 'بطانة', 'Bettana'],
    ['sidimoussa', 'سيدي موسى', 'Sidi Moussa'], ['haykarima', 'حي كريمة', 'Hay Karima'], ['laayayda', 'العيايدة', 'Laâyayda'],
    ['salajadida', 'سلا الجديدة', 'Sala Al Jadida'], ['hssaine', 'احصين', 'Hssaine'],
  ]),
  ...n('fes', [
    ['fesbali', 'فاس البالي', 'Fès El Bali'], ['fesjdid', 'فاس الجديد', 'Fès Jdid'], ['villenouvelle', 'المدينة الجديدة', 'Ville Nouvelle'],
    ['saiss', 'سايس', 'Saïss'], ['narjiss', 'النرجس', 'Narjiss'], ['zouagha', 'زواغة', 'Zouagha'], ['agdal', 'أكدال', 'Agdal'],
    ['imouzzer', 'طريق إيموزار', "Route d'Imouzzer"], ['bensouda', 'بنسودة', 'Bensouda'], ['aouinat', 'عوينات الحجاج', 'Aouinat Hajjaj'],
  ]),
  ...n('marrakech', [
    ['gueliz', 'جليز', 'Guéliz'], ['medina', 'المدينة القديمة', 'Médina'], ['hivernage', 'الحي الشتوي', 'Hivernage'],
    ['daoudiate', 'الداوديات', 'Daoudiate'], ['massira', 'المسيرة', 'Massira'], ['sidiyoussef', 'سيدي يوسف بن علي', 'Sidi Youssef Ben Ali'],
    ['mhamid', 'المحاميد', "M'Hamid"], ['targa', 'تاركة', 'Targa'], ['annakhil', 'النخيل', 'Annakhil'],
    ['semlalia', 'السملالية', 'Semlalia'], ['azli', 'أزلي', 'Azli'],
  ]),
  ...n('tanger', [
    ['centre', 'وسط المدينة', 'Centre-ville'], ['malabata', 'ملابطا', 'Malabata'], ['marshan', 'مرشان', 'Marshan'],
    ['iberia', 'إيبيريا', 'Iberia'], ['boukhalef', 'بوخالف', 'Boukhalef'], ['mesnana', 'مسنانة', 'Mesnana'],
    ['benimakada', 'بني مكادة', 'Beni Makada'], ['mghogha', 'مغوغة', 'Mghogha'], ['valfleuri', 'فال فلوري', 'Val Fleuri'],
    ['dradeb', 'الدرادب', 'Dradeb'],
  ]),
  ...n('oujda', [
    ['centre', 'وسط المدينة', 'Centre-ville'], ['lazaret', 'لازاري', 'Lazaret'], ['alqods', 'حي القدس', 'Hay Al Qods'],
    ['sidimaafa', 'سيدي معافة', 'Sidi Maâfa'], ['massira', 'المسيرة', 'Al Massira'], ['andalous', 'حي الأندلس', 'Hay Andalous'],
    ['sidiyahya', 'سيدي يحيى', 'Sidi Yahya'],
  ]),
  ...n('agadir', [
    ['talborjt', 'تالبرجت', 'Talborjt'], ['dakhla', 'حي الداخلة', 'Hay Dakhla'], ['haymohammadi', 'الحي المحمدي', 'Hay Mohammadi'],
    ['charaf', 'الشرف', 'Charaf'], ['founty', 'فونتي', 'Founty'], ['salam', 'السلام', 'Salam'], ['tilila', 'تيليلا', 'Tilila'],
    ['anza', 'أنزا', 'Anza'], ['bensergao', 'بنسركاو', 'Bensergao'], ['alhouda', 'حي الهدى', 'Hay Al Houda'],
  ]),
  ...n('meknes', [
    ['hamria', 'حمرية', 'Hamria'], ['medina', 'المدينة القديمة', 'Médina'], ['marjane', 'مرجان', 'Marjane'],
    ['bassatine', 'البساتين', 'Bassatine'], ['sidibaba', 'سيدي بابا', 'Sidi Baba'], ['zitoune', 'الزيتون', 'Zitoune'],
    ['wislane', 'ويسلان', 'Wislane'], ['toulal', 'تولال', 'Toulal'],
  ]),
  ...n('kenitra', [
    ['centre', 'وسط المدينة', 'Centre-ville'], ['birrami', 'بئر الرامي', 'Bir Rami'], ['maamora', 'المعمورة', 'Maâmora'],
    ['ouledoujih', 'أولاد أوجيه', 'Ouled Oujih'], ['saknia', 'الساكنية', 'Saknia'], ['mimosas', 'الميموزا', 'Mimosas'],
    ['valfleuri', 'فال فلوري', 'Val Fleuri'], ['khabazat', 'الخبازات', 'Khabazat'],
  ]),
]

export const ALL_NEIGHBORHOODS = 'all'
export const DEFAULT_CITY = 'casablanca'

export const cityById = (id: string) => moroccanCities.find(x => x.id === id)
export const neighborhoodById = (id: string) => neighborhoods.find(x => x.id === id)
export const neighborhoodsOf = (cityId: string) => neighborhoods.filter(x => x.city === cityId)
