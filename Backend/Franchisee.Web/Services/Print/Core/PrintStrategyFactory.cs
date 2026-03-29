using System;
using System.Collections.Generic;
using System.Linq;
using Franchisee.Web.Models.Print;

namespace Franchisee.Web.Services.Print.Core
{
    public class PrintStrategyFactory
    {
        private readonly Dictionary<PrintType, IPrintStrategy> _strategies;
        
        public PrintStrategyFactory(IEnumerable<IPrintStrategy> strategies)
        {
            _strategies = strategies.ToDictionary(s => s.Type);
        }
        
        public IPrintStrategy GetStrategy(PrintType type)
        {
            if (_strategies.TryGetValue(type, out var strategy))
                return strategy;
            
            throw new ArgumentException($"Стратегия для типа печати {type} не найдена");
        }
    }
}