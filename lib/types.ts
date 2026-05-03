export type PointsQuery = {
  query?: string;
  city?: string;
  province?: string;
  country?: string;
  function?: string;
  status?: string;
  availability?: string;
  open24?: boolean;
  perPage: number;
  maxPages: number;
};

export type PointAddress = {
  line1: string | null;
  line2: string | null;
};

export type PointAddressDetails = {
  city: string | null;
  province: string | null;
  postCode: string | null;
  street: string | null;
  buildingNumber: string | null;
};

export type LockerAvailability = {
  status: string;
  details?: Record<string, string> | null;
};

export type Point = {
  id: string;
  name: string;
  country: string;
  type: string[];
  status: string;
  location: {
    latitude: number | null;
    longitude: number | null;
  };
  address: PointAddress;
  addressDetails: PointAddressDetails;
  openingHours: string | null;
  functions: string[];
  locationType: string | null;
  locationDescription: string | null;
  paymentAvailable: boolean | null;
  lockerAvailability: LockerAvailability | null;
};

export type PointsMeta = {
  pagesFetched: number;
  totalFetched: number;
  totalFiltered: number;
  totalPages: number | null;
  fetchedAt: string;
};

export type PointsResponse = {
  query: PointsQuery;
  meta: PointsMeta;
  items: Point[];
  errors?: string[];
};
