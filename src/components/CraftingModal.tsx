import React, { useState } from 'react';
import { CraftingRecipe, EquippedGear, ResourceItem } from '../types/game';
import { CRAFTING_RECIPES } from '../utils/craftingData';
import { X, Hammer, Shield, Sparkles, Check, AlertCircle, Wrench, Shirt, Tent, HeartPulse, Info } from 'lucide-react';
import { sound } from '../utils/audio';

interface CraftingModalProps {
  resources: ResourceItem[];
  equippedGear: EquippedGear;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
  onClose: () => void;
}

export const CraftingModal: React.FC<CraftingModalProps> = ({
  resources,
  equippedGear,
  onCraftRecipe,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CLOTHING' | 'TOOL' | 'SHELTER' | 'SURVIVAL'>('ALL');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(CRAFTING_RECIPES[0].id);

  // Resource map for fast quantity checking
  const resourceMap = new Map<string, number>();
  resources.forEach(r => resourceMap.set(r.type, r.count));

  const filteredRecipes = activeCategory === 'ALL'
    ? CRAFTING_RECIPES
    : CRAFTING_RECIPES.filter(r => r.category === activeCategory);

  const selectedRecipe = CRAFTING_RECIPES.find(r => r.id === selectedRecipeId) || filteredRecipes[0];

  // Check if player has all ingredients
  const canCraft = selectedRecipe
    ? selectedRecipe.ingredients.every(ing => (resourceMap.get(ing.type) || 0) >= ing.amount)
    : false;

  const handleCraft = () => {
    if (!selectedRecipe || !canCraft) return;
    sound.playCraftSuccess();
    onCraftRecipe(selectedRecipe);
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] bg-neutral-900 border-2 border-amber-600/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono-tech crt-overlay">
        {/* Terminal Header */}
        <div className="bg-neutral-950 border-b border-amber-700/60 px-4 py-3 flex justify-between items-center text-amber-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-600 flex items-center justify-center text-amber-300">
              <Hammer className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-widest uppercase">
                ПОЛЕВАЯ МАСТЕРСКАЯ // КРАФТ И СБОРКА СНАРЯЖЕНИЯ
              </div>
              <div className="text-[10px] text-amber-600">
                СИБИРСКИЙ ТАЁЖНЫЙ КРАФТ | МОДИФИКАЦИЯ ЭКИПИРОВКИ
              </div>
            </div>
          </div>

          <button
            id="btn-close-crafting"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-amber-800 text-amber-400 hover:text-amber-100 hover:bg-amber-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resources Belt (Current Inventory) */}
        <div className="bg-neutral-950/70 border-b border-neutral-800 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider shrink-0 font-semibold">
            РЕСУРСЫ В РЮКЗАКЕ:
          </span>
          <div className="flex items-center gap-2">
            {resources.map(res => (
              <div
                key={res.type}
                className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0 ${
                  res.count > 0
                    ? 'bg-neutral-900 border-neutral-700 text-neutral-200'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-600 opacity-60'
                }`}
                title={`${res.name}: ${res.count} шт. (${res.description})`}
              >
                <span>{res.icon}</span>
                <span className="text-xs font-semibold">{res.name.split(' ')[0]}</span>
                <span className={`text-xs font-bold ${res.count > 0 ? 'text-amber-400' : 'text-neutral-500'}`}>
                  {res.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="bg-neutral-950/40 border-b border-neutral-800/80 px-3 py-1.5 flex gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeCategory === 'ALL'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            ВСЕ РЕЦЕПТЫ ({CRAFTING_RECIPES.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('CLOTHING')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeCategory === 'CLOTHING'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            ТЕПЛАЯ ОДЕЖДА
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('SHELTER')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeCategory === 'SHELTER'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Tent className="w-3.5 h-3.5" />
            УКРЫТИЯ В БУРАН
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('TOOL')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeCategory === 'TOOL'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            ИНСТРУМЕНТЫ
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('SURVIVAL')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeCategory === 'SURVIVAL'
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            ВЫЖИВАНИЕ И РЕМОНТ
          </button>
        </div>

        {/* Main Content Area (Two Columns: Recipe List & Recipe Details) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* Left Column: List of Recipes */}
          <div className="md:col-span-6 border-r border-neutral-800/80 overflow-y-auto p-3 flex flex-col gap-2 max-h-[55vh] md:max-h-[60vh]">
            {filteredRecipes.map(recipe => {
              const recipeCanCraft = recipe.ingredients.every(
                ing => (resourceMap.get(ing.type) || 0) >= ing.amount
              );
              const isSelected = recipe.id === selectedRecipe?.id;

              return (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipeId(recipe.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500/80 shadow-md'
                      : 'bg-neutral-950/50 border-neutral-800 hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl p-2 rounded-lg bg-neutral-900 border border-neutral-700 shrink-0">
                      {recipe.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                        {recipe.name}
                        {recipe.resultCount > 1 && (
                          <span className="text-[10px] bg-amber-900/60 text-amber-300 px-1 rounded border border-amber-700">
                            x{recipe.resultCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                        {recipe.description}
                      </div>
                      <div className="text-[10px] text-amber-400/90 mt-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {recipe.benefits}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    {recipeCanCraft ? (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-600 px-2 py-0.5 rounded font-bold">
                        ГОТОВО
                      </span>
                    ) : (
                      <span className="text-[10px] bg-neutral-900 text-neutral-500 border border-neutral-800 px-1.5 py-0.5 rounded">
                        НЕТ РЕСУРСОВ
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Recipe Details & Assembly Action */}
          <div className="md:col-span-6 p-4 flex flex-col justify-between overflow-y-auto max-h-[55vh] md:max-h-[60vh] bg-neutral-950/40">
            {selectedRecipe ? (
              <div className="flex flex-col gap-4">
                {/* Header Card */}
                <div className="flex items-start gap-3.5 bg-neutral-900/90 border border-neutral-700/80 p-3.5 rounded-xl">
                  <div className="w-14 h-14 rounded-xl bg-amber-950/70 border border-amber-600 flex items-center justify-center text-3xl shrink-0">
                    {selectedRecipe.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-neutral-100">
                      {selectedRecipe.name}
                    </div>
                    <div className="text-[11px] text-amber-400 font-medium mt-0.5">
                      {selectedRecipe.category === 'CLOTHING' && '🛡️ Экипировка курьера'}
                      {selectedRecipe.category === 'SHELTER' && '⛺ Быстровозводимое укрытие'}
                      {selectedRecipe.category === 'TOOL' && '🪜 Полевой инструмент'}
                      {selectedRecipe.category === 'SURVIVAL' && '❤️ Расходник выживания'}
                    </div>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      {selectedRecipe.description}
                    </p>
                  </div>
                </div>

                {/* Tactical Benefits Banner */}
                <div className="bg-emerald-950/30 border border-emerald-700/60 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold">Эффект: </span>
                    {selectedRecipe.benefits}
                  </div>
                </div>

                {/* Required Components Checklist */}
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    ТРЕБУЕМЫЕ КОМПОНЕНТЫ:
                  </div>

                  <div className="flex flex-col gap-2">
                    {selectedRecipe.ingredients.map(ing => {
                      const currentAmount = resourceMap.get(ing.type) || 0;
                      const hasEnough = currentAmount >= ing.amount;
                      const resMeta = resources.find(r => r.type === ing.type);

                      return (
                        <div
                          key={ing.type}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                            hasEnough
                              ? 'bg-neutral-900 border-neutral-700 text-neutral-200'
                              : 'bg-red-950/20 border-red-900/60 text-red-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{resMeta?.icon || '📦'}</span>
                            <span className="font-semibold">{resMeta?.name || ing.type}</span>
                          </div>

                          <div className="flex items-center gap-2 font-bold">
                            <span className={hasEnough ? 'text-emerald-400' : 'text-red-400'}>
                              {currentAmount} / {ing.amount} шт.
                            </span>
                            {hasEnough ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Equipped Gear Reminder if Clothing */}
                {selectedRecipe.category === 'CLOTHING' && (
                  <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 text-[11px] text-neutral-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-neutral-500 shrink-0" />
                    <span>
                      После изготовления предмет автоматически экипируется на курьера и дает постоянные пассивные бонусы.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-neutral-500 py-10">Выберите рецепт для просмотра деталей</div>
            )}

            {/* Craft Button */}
            <div className="mt-4 pt-3 border-t border-neutral-800">
              <button
                id="btn-craft-item"
                type="button"
                onClick={handleCraft}
                disabled={!canCraft}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 ${
                  canCraft
                    ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-900/30 cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                }`}
              >
                <Hammer className="w-4 h-4" />
                <span>
                  {canCraft ? `ИЗГОТОВИТЬ: ${selectedRecipe?.name}` : 'НЕДОСТАТОЧНО РЕСУРСОВ'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
