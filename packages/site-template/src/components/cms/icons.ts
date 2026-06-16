// src/components/cms/icons.ts
//
// Curated icon allowlist for FeatureList. Operators select an icon by
// string name in the CMS; we map to a Preact component here. Adding a
// new icon is a 2-line change: import + add to the map.
//
// We avoid `import * as Icons from "lucide-preact"` because it forces
// the bundler to include EVERY icon (~500 KB unzipped). Tree-shaking
// only works with named imports, so we explicitly list what we ship.

import {
  Activity, Award, BarChart, Bell, Bookmark, Briefcase, Calendar, Check,
  CheckCircle, Clock, Code, Coffee, Compass, Copy, Cpu, Database, Download,
  Edit, ExternalLink, Eye, File, FileText, Filter, Flag, Folder, Gift,
  Globe, Grid, Hash, Heart, Home, Image, Inbox, Info, Layers, Layout,
  Link as LinkIcon, List, Lock, Mail, Map, MapPin, Maximize, Menu,
  MessageCircle, Mic, Monitor, Moon, MoreHorizontal, Move, Music, Package,
  Paperclip, Pause, PenTool, Phone, Play, Plus, Power, Printer, Radio,
  RefreshCw, Rocket, Rss, Save, Search, Send, Server, Settings, Share,
  Shield, ShoppingBag, ShoppingCart, Sliders, Smartphone, Star, Sun, Tag,
  Target, Terminal, ThumbsUp, Trash, TrendingUp, Truck, Tv, Type, Umbrella,
  Unlock, Upload, User, Users, Video, Volume, Wifi, X, Zap, ZoomIn,
} from "lucide-preact"
import type { LucideIcon } from "lucide-preact"

export const ICON_MAP: Record<string, LucideIcon> = {
  activity: Activity, award: Award, "bar-chart": BarChart, bell: Bell,
  bookmark: Bookmark, briefcase: Briefcase, calendar: Calendar, check: Check,
  "check-circle": CheckCircle, clock: Clock, code: Code, coffee: Coffee,
  compass: Compass, copy: Copy, cpu: Cpu, database: Database, download: Download,
  edit: Edit, "external-link": ExternalLink, eye: Eye, file: File,
  "file-text": FileText, filter: Filter, flag: Flag, folder: Folder, gift: Gift,
  globe: Globe, grid: Grid, hash: Hash, heart: Heart, home: Home, image: Image,
  inbox: Inbox, info: Info, layers: Layers, layout: Layout, link: LinkIcon,
  list: List, lock: Lock, mail: Mail, map: Map, "map-pin": MapPin,
  maximize: Maximize, menu: Menu, "message-circle": MessageCircle, mic: Mic,
  monitor: Monitor, moon: Moon, "more-horizontal": MoreHorizontal, move: Move,
  music: Music, package: Package, paperclip: Paperclip, pause: Pause,
  "pen-tool": PenTool, phone: Phone, play: Play, plus: Plus, power: Power,
  printer: Printer, radio: Radio, "refresh-cw": RefreshCw, rocket: Rocket,
  rss: Rss, save: Save, search: Search, send: Send, server: Server,
  settings: Settings, share: Share, shield: Shield, "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart, sliders: Sliders, smartphone: Smartphone,
  star: Star, sun: Sun, tag: Tag, target: Target, terminal: Terminal,
  "thumbs-up": ThumbsUp, trash: Trash, "trending-up": TrendingUp, truck: Truck,
  tv: Tv, type: Type, umbrella: Umbrella, unlock: Unlock, upload: Upload,
  user: User, users: Users, video: Video, volume: Volume, wifi: Wifi, x: X,
  zap: Zap, "zoom-in": ZoomIn,
}

export function resolveIcon(name: string | null | undefined) {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return ICON_MAP[key] ?? null
}
