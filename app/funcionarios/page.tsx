'use client';

import { DashboardLayout } from '@/components/dashboard-layout';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Calendar } from 'lucide-react';
import MensalistasContent from './mensalistas-content';
import DiaristasContent from './diaristas-content';

export default function FuncionariosPage() {
  const [activeTab, setActiveTab] = useState('mensalistas');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl text-[#FFD86F] mb-2" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: 'normal' }}>
            Funcionários
          </h1>
          <p className="text-muted" style={{ fontFamily: 'Inter, sans-serif' }}>
            Gestão completa de mensalistas e diaristas
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="mensalistas" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Mensalistas
            </TabsTrigger>
            <TabsTrigger value="diaristas" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Diaristas / Ponto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensalistas">
            <MensalistasContent />
          </TabsContent>

          <TabsContent value="diaristas">
            <DiaristasContent />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
