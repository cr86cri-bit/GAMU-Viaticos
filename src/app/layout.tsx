import {NotificationProvider} from '@/components/notifications';
import './globals.css';import type { Metadata,Viewport } from 'next';
export const metadata:Metadata={title:'GAMU | Pasajes y Viáticos',description:'Sistema institucional de gestión de pasajes y viáticos',applicationName:'Viáticos GAMU',appleWebApp:{capable:true,title:'Viáticos GAMU',statusBarStyle:'default'},manifest:'/manifest.webmanifest'};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#06141B'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body><NotificationProvider>{children}</NotificationProvider></body></html>}
