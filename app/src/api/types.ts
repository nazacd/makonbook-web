import type { paths } from './schema';
import type { Schemas } from './client';

export type Profile = Schemas['Profile'];
export type Group = Schemas['Group'];
export type Slot = Schemas['Slot'];
export type Weekday = Slot['weekdays'][number];
export type LoginResponse = Schemas['LoginResponse'];

export type MyAttendance =
  paths['/v1/me/attendance']['get']['responses'][200]['content']['application/json'];
export type GroupAttendance = MyAttendance['groups'][number];
export type DayState = GroupAttendance['days'][number]['state'];
