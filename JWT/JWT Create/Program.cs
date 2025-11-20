using System;
using System.Security.Cryptography;

class Program
{
    static void Main()
    {
        using (var rng = new RNGCryptoServiceProvider())
        {
            var key = new byte[32];
            rng.GetBytes(key);
            Console.WriteLine("JWT Key: " + Convert.ToBase64String(key));
        }

        Console.ReadKey();
    }
}