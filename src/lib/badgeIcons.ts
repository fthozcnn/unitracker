/**
 * Badge icon registry — maps icon names stored in the database
 * to their Lucide React components. This avoids `import * as Icons`
 * which prevents tree-shaking of the entire lucide-react library.
 */
import {
    Medal, Flame, Star, Zap, Trophy, Coffee, Moon, Sun,
    BookOpen, Target, ShieldCheck, Clock, Calendar, Users,
    Swords, GraduationCap, Compass, Activity, Palette,
    Award, Crown, Brain, Heart, Sparkles, Rocket, Eye,
    Layers, TrendingUp, Music, Lightbulb, MapPin, Flag,
    type LucideIcon
} from 'lucide-react'

const BADGE_ICONS: Record<string, LucideIcon> = {
    Medal, Flame, Star, Zap, Trophy, Coffee, Moon, Sun,
    BookOpen, Target, ShieldCheck, Clock, Calendar, Users,
    Swords, GraduationCap, Compass, Activity, Palette,
    Award, Crown, Brain, Heart, Sparkles, Rocket, Eye,
    Layers, TrendingUp, Music, Lightbulb, MapPin, Flag,
}

/**
 * Resolves a badge icon name (from DB) to a Lucide component.
 * Falls back to Medal if the icon name is not in the registry.
 */
export function getBadgeIcon(iconName: string): LucideIcon {
    return BADGE_ICONS[iconName] || Medal
}
