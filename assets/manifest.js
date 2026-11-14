/* 에셋 목록 — assets/ 폴더의 md(배경 리스트 · CG 리스트 · 캐릭터 행동 리스트) 기준.
 *
 * 경로는 assets/ 기준. 파일을 새로 만들면 해당 줄의 null 을 파일 경로로 바꾸면 됩니다.
 *   null 인 배경 → fallback 배경으로 대신 표시
 *   null 인 CG   → CG 없이 스탠딩으로 진행
 * 캐릭터 webp 의 흰 배경은 게임이 불러올 때 자동으로 투명하게 지웁니다 (원본 파일은 그대로).
 */
window.ASSETS = {
  // ---------------------------------------------------------------- 캐릭터 (포즈 차분)
  chars: {
    cal: {
      name: '계산기 본부장', dir: 'char/계산기 본부장/',
      poses: {
        기본: '계산기-기본.webp',    // 0. 시계 확인
        업무: '계산기-업무.webp',    // 1250000 서류 검토
        다정: '계산기-다정.webp',    // 커피 건넴
        다정2: '계산기-다정2.webp',  // 머리 갸웃
        당황: '계산기-당황.webp',    // E
        질투: '계산기-질투.webp',    // 99999999 넥타이 조임
        자리권유: null, 재킷걸침: null, 순정: null,
      },
    },
    sta: {
      name: '호치키스 대리', dir: 'char/호치키스 대리/',
      poses: {
        기본: '호치키스-기본.png',
        업무: '호치키스-업무.webp',
        다정: '호치키스-다정.webp',
        질투: '호치키스-질투.webp',   // 팔짱, 단호
        당황: '호치키스-당황.webp',   // 살짝 들림 + 심
        당황2: '호치키스-당황2.webp', // 크게 열림 + 서류로 가림
        어깨톡톡: null, 의자빼기: null, 초콜릿: null, 순정: null,
      },
    },
    cop: {
      name: '복사기', dir: 'char/복사기 사원/',
      poses: {
        기본: '복사기-기본.png',
        능글: '복사기-능글.webp',
        신남: '복사기-신남.webp',
        시무룩: '복사기-시무룩.webp',
        당황: '복사기-당황.webp',
        기합: '복사기-기합.webp',
        쇼핑백: null, 질투: null, 순정: null,
      },
    },
    suki:  { name: '정수기 팀장', dir: 'char/정수기 팀장/', poses: { 기본: '정수기-기본.webp', 커피: '정수기-커피.webp' } },
    clock: { name: '시계 과장',   dir: 'char/시계 과장/',   poses: { 기본: '시계-기본.webp', 시무룩: '시계-시무룩.webp' } },
    yong:  { name: '용지',       dir: 'char/복사용지/',    poses: { 기본: '복사용지-기본.webp', 도발: '복사용지-도발.webp', 커피: '복사용지-커피-v1.webp' } },
    mouse: { name: '마우스',     dir: 'char/마우스 사원/', small: true, poses: { 기본: '마우스-기본.webp' } },
  },

  // ---------------------------------------------------------------- 배경  키: [파일, 장소 표시, (파일 없을 때 대신 쓸 배경 키)]
  bgs: {
    room_day:      ['bg/여주방-아침.webp', '여주 방'],
    room_night:    ['bg/여주방-밤.webp', '여주 방'],
    building:      ['bg/회사앞-아침.png', '회사 건물'],
    desk:          ['bg/사무실-아침.webp', '여주 자리'],
    side:          ['bg/사무실-아침.webp', '여주 옆자리'],
    desk_eve:      ['bg/사무실-노을.webp', '사무실'],
    store:         ['bg/사내편의점.webp', '사내 편의점'],
    store_front:   ['bg/편의점앞.webp', '편의점 앞'],
    gate_day:      ['bg/회사앞-아침.png', '회사 앞'],
    gate_night:    ['bg/회사앞-밤.png', '회사 앞'],
    pantry:        ['bg/탕비실.webp', '탕비실'],
    elevator:      ['bg/엘리베이터앞.webp', '엘베 앞'],
    car_day:       ['bg/자동차-아침.webp', '자동차'],
    car_night:     ['bg/자동차-밤.webp', '자동차'],
    baekban:       ['bg/백반집-점심.png', '백반집'],
    baekban_night: ['bg/백반집-회식.webp', '백반집'],
    western:       ['bg/양식당.webp', '양식당'],
    director:      ['bg/본부장실.webp', '본부장실'],
    calhome:       ['bg/계산기집.webp', '계산기 집'],
    park:          ['bg/공원-밤.webp', '집 앞 공원'],
    date:          ['bg/첫데이트.webp', '카페 거리'],
    // 그림 없음 — 대체 배경으로 표시
    restaurant_front: [null, '식당 앞', 'gate_night'],
    homeway:       [null, '귀갓길', 'gate_night'],
    cinema:        [null, '영화관 로비', 'date'],
  },

  // ---------------------------------------------------------------- CG (시나리오 V2.1 · CG 리스트.md)
  // 키: { 차분이름: 파일 }. 시나리오에서 @cg STA01 → 기본, @cg STA01 뚜껑열림 → 차분으로 교체.
  // 차분 파일이 없으면 지금 그림을 유지, CG 전체가 없으면 CG 없이 스탠딩으로 진행.
  cgs: {
    STA01: { 기본: 'cg/CG-호치키스첫만남.webp', 뚜껑열림: null },        // CH1 가까운 거리의 호치키스
    COP01: { 기본: 'cg/CG-바나나우유.webp' },                           // CH2 마지막 바나나 우유
    CAL01: { 기본: 'cg/CG-계산기첫만남.webp', ERROR: null },            // CH3 탕비실에서 일으켜주는 계산기
    COP02: { 기본: null, 스캔빛: null, 종이: null },                     // CH4 핸드크림 선물
    CAL02: { 기본: null },                                              // CH6 회식 의자 빼주는 계산기
    STA02: { 기본: null },                                              // CH6 회식 귓속말 호치키스
    CAL03: { ERROR: null, '143': null, 손잡기: null },                  // 계산기 루트 · 계산기 집 고백
    STA03: { 심엉킴: null, 손잡기: null },                               // 호치키스 루트 · 자동차 고백
    COP03: { 기본: null, 스캔빛: null },                                 // 복사기 루트 · 영화관 첫 데이트
    COP04: { 기본: null, 고백종이: null, 포옹: null },                   // 복사기 루트 · 공원 고백
  },
};
