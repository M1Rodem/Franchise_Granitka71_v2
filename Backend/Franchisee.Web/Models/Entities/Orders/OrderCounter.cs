using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Franchisee.Web.Models.Entities.Orders
{
    [Table("OrderCounters")]
    public class OrderCounter
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; } = 1;

        public int LastNumber { get; set; } = 0;
    }
}